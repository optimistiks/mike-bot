# Research: reaction add vs remove (`message_reaction`)

**Ticket:** wayfinder #04 — What does a reaction add vs remove look like?  
**Sources:** [Telegram Bot API — `MessageReactionUpdated`](https://core.telegram.org/bots/api#messagereactionupdated), [Grammy — Reactions guide](https://grammy.dev/guide/reactions), [Grammy — `Composer.reaction`](https://grammy.dev/ref/core/composer#reaction), [Grammy — `Context.reactions`](https://grammy.dev/ref/core/context#reactions)  
**Domain:** `CONTEXT.md`, ADR-0002 (reaction scoring)

---

## TL;DR

| Event | `old_reaction` | `new_reaction` | Mark effect |
|-------|----------------|----------------|-------------|
| **Pure add** | `[]` | `[{type:"emoji", emoji:"…"}]` | Apply Mark for each scoring emoji in **added** set |
| **Pure remove** | `[{…}]` | `[]` | Undo Mark for each scoring emoji in **removed** set |
| **Switch karma ±** | `[karma+]` | `[karma−]` | Undo old karma Mark, apply new (one atomic update) |
| **Add humor while keeping karma** | `[karma+]` | `[karma+, humor]` | Apply humor Mark only; karma unchanged |

Use **`bot.on("message_reaction")`** + **`ctx.reactions()`** (or manual old/new diff). Do **not** rely on **`bot.reaction()`** alone — it fires only on add, never on remove.

---

## Update shape: `MessageReactionUpdated`

Telegram delivers reaction changes as `Update.message_reaction`:

```json
{
  "update_id": 123,
  "message_reaction": {
    "chat": { "id": -100123, "type": "supergroup", "title": "…" },
    "message_id": 456,
    "user": {
      "id": 789,
      "is_bot": false,
      "first_name": "…"
    },
    "date": 1710000000,
    "old_reaction": [],
    "new_reaction": [{ "type": "emoji", "emoji": "👍" }]
  }
}
```

| Field | Type | Meaning |
|-------|------|---------|
| `chat` | `Chat` | Chat containing the reacted message |
| `message_id` | `Integer` | Target message id **inside that chat** |
| `user` | `User?` | Member who changed their reaction (when not anonymous) |
| `actor_chat` | `Chat?` | Chat on whose behalf the reaction changed (anonymous cases) |
| `date` | `Integer` | Unix timestamp of the change |
| `old_reaction` | `ReactionType[]` | This user's reactions **before** the change |
| `new_reaction` | `ReactionType[]` | This user's reactions **after** the change |

`ReactionType` is one of:

- `ReactionTypeEmoji` — `{ type: "emoji", emoji: "👍" }`
- `ReactionTypeCustomEmoji` — `{ type: "custom_emoji", custom_emoji_id: "…" }`
- `ReactionTypePaid` — `{ type: "paid" }`

**Important:** The update describes **one user's** reaction list changing on **one message**. It does **not** include other users' reactions on the same message, message text, or message author.

---

## Diff algorithm: apply / undo Mark

Each `message_reaction` update is a transition `old_reaction → new_reaction` for a single user. Treat scoring impact as set operations on emoji (filter to the three configured Scoring reactions).

### Manual diff (Telegram lists)

```ts
function diffReactions(old: ReactionType[], now: ReactionType[]) {
  const toEmoji = (r: ReactionType[]) =>
    r.filter((x) => x.type === "emoji").map((x) => x.emoji);

  const prev = new Set(toEmoji(old));
  const next = new Set(toEmoji(now));

  return {
    added: [...next].filter((e) => !prev.has(e)),
    removed: [...prev].filter((e) => !next.has(e)),
    kept: [...next].filter((e) => prev.has(e)),
    current: [...next],
  };
}
```

| Transition | `added` | `removed` | Mark action |
|------------|---------|-----------|-------------|
| First reaction | scoring emoji | — | **Apply** Mark (marker → author, type from emoji) |
| Remove only | — | scoring emoji | **Undo** Mark |
| Replace karma+ with karma− | karma− | karma+ | **Undo** karma+ Mark, **apply** karma− Mark |
| Add humor, keep karma+ | humor | — | **Apply** humor Mark only |
| Remove humor, keep karma+ | — | humor | **Undo** humor Mark only |
| Clear all | — | all scoring | **Undo** each removed scoring Mark |

**Apply:** For each emoji in `added` that maps to a Scoring reaction, persist a Mark `(chat, message_id, marker=user, author=…, type, season)`.  
**Undo:** For each emoji in `removed` that maps to a Scoring reaction, delete/reverse the corresponding Mark for `(chat, message_id, marker=user, type)`.

Grammy computes the same split via `ctx.reactions()`:

```ts
bot.on("message_reaction", async (ctx) => {
  const { emojiAdded, emojiRemoved, emojiKept, emoji } = ctx.reactions();
  // emojiAdded  → apply Marks
  // emojiRemoved → undo Marks
  // emoji        → current set after update (= new_reaction emojis)
});
```

Also available: `customEmojiAdded/Removed/Kept`, `paid`, `paidAdded`, `paidRemoved`.

### Batched changes in one update

Telegram (and Grammy) explicitly document that **one update can add and remove multiple reactions at once**, even though clients rarely expose that in the UI. Example from Grammy docs: user adds 🎉 and removes a custom emoji in the same event — `emojiAdded: ['🎉']`, `customEmojiRemoved: ['id0123']`.

For Mike-bot, handle **both** arrays in a single handler invocation; order within the update should not matter if apply/undo are keyed by `(marker, message, reaction_type)`.

---

## `user` field and message author access

### Who reacted (`user` / `actor_chat`)

- **`user`:** The Member who changed the reaction, when identifiable.
- **`actor_chat`:** Present when the reactor is anonymous (e.g. channel/group acting as sender). For Mike-bot's target supergroup, expect **`user`** with `is_bot: false` for normal members.
- Grammy shortcut: **`ctx.from`** resolves to `messageReaction.user` on reaction updates.

Use `user.id` as the **marker** (who applied or removed the Mark). Check **`user.is_bot === true`** and ignore — though see bot-reaction caveat below.

### Message author — **not in the update**

`MessageReactionUpdated` carries only `chat` + `message_id`. Grammy states explicitly:

> We only receive the message identifier, not the message content.

There is **no Bot API method to fetch an arbitrary historical group message by id**. Implications for v2:

1. **Cache on ingest:** On `message` updates, store `(chat_id, message_id) → author_user_id` (and `from.is_bot` for author-is-bot rule).
2. **Lookup at reaction time:** Resolve author from cache/DB before applying domain rules (no self, no bots).
3. **Missed cache:** If the bot was offline or the message predates the bot, author may be unknown — decide whether to ignore the reaction or backfill (out of scope for this ticket).

Self-mark check: compare `messageReaction.user.id` (marker) to cached **author** id for `message_id`, not to any field on the reaction update itself.

---

## Admin requirement (groups)

Per [Bot API `Update`](https://core.telegram.org/bots/api#update):

> The bot **must be an administrator in the chat** and must explicitly specify `"message_reaction"` in the list of `allowed_updates` to receive these updates.

Requirements for Mike-bot v2:

| Requirement | Detail |
|-------------|--------|
| Group admin | Bot promoted to administrator in the scoring supergroup (wayfinder ticket #13) |
| `allowed_updates` | Webhook / `getUpdates` must include `"message_reaction"` — **excluded by default** when `allowed_updates` is omitted or empty |
| Bot reactions ignored | Updates are **not received for reactions set by bots** — bot emoji reactions never drive Marks |

Grammy also notes admin for `message_reaction_count` (channels / forwarded channel posts); Mike-bot targets a group with identifiable users, so **`message_reaction`** is the relevant type.

**Private chats:** API text still says "administrator in the chat." Admin is a group/channel concept; empirical reports say `message_reaction` push updates do not work in 1:1 DMs. Irrelevant for Mike-bot (group-only scoring).

---

## Can a user hold multiple reactions at once?

**Yes.** Grammy:

> users can actually change several reactions at once … reaction updates give you two lists, the old reactions and the new reactions.

Telegram models each user's contribution as an **array** (`old_reaction` / `new_reaction`), not a single emoji. A user may simultaneously have e.g. 👍 + 🎉 on the same message within one update's `new_reaction` list.

Bot API `setMessageReaction` note: bots (non-premium) may set **up to one** reaction per message — user limits are separate from bot limits.

---

## Mapping to domain rules

Rules from `CONTEXT.md` and ADR-0002:

| Rule | Telegram behavior | v2 handling |
|------|-------------------|-------------|
| **No self** | API does not block self-reaction | After author lookup: if `marker.id === author.id`, ignore (no apply/undo) |
| **No bots** | Bot reactions don't emit updates; author may be a bot | Ignore if `user.is_bot` or cached `author.is_bot` |
| **Karma+ / Karma− mutually exclusive** | Telegram **allows** multiple emojis; does **not** enforce exclusivity | Enforce in app logic on `new_reaction` / `emoji` after diff |
| **Switching karma ± allowed** | Appears as `removed: [karma+]`, `added: [karma−]` in one update (or remove then add as two updates) | Undo old karma Mark, apply new — matches ADR "undo by removing" |
| **Humor independent** | Humor emoji can coexist with karma emoji in `new_reaction` | Apply/undo humor Marks independently via `emojiAdded` / `emojiRemoved` |

### Karma mutual exclusion — implementation note

Telegram will **not** prevent a member from having both Karma plus and Karma minus on the same message if they add both without removing. Example problematic state: `new_reaction: [karma+, karma−]`.

Recommended handling (product decision, not API-enforced):

- **On apply:** If adding karma+ while karma− is in `emoji` (current), treat as switch — undo karma−, apply karma+ (or reject the add).
- **On any update:** After diff, if both karma types appear in `emoji`, normalize to the most recently **added** one in this update, or reject the whole update.

Humor is unaffected: karma+ and humor in `new_reaction` is valid and should create two independent Marks.

---

## Grammy: `bot.reaction()` vs `bot.on("message_reaction")`

| | `bot.reaction("👍", handler)` | `bot.on("message_reaction", handler)` |
|---|------------------------------|---------------------------------------|
| **Fires on add** | Yes — when listed emoji **newly added** | Yes |
| **Fires on remove** | **No** | Yes — full old/new diff |
| **Undo Marks** | **Cannot** — remove events never run | **Required** for undo-on-remove (ADR-0002) |
| **Switch karma ±** | May fire twice (remove handler missing) or miss undo | Single update with both `emojiRemoved` and `emojiAdded` |
| **Multiple emoji in one update** | One handler per matching **added** emoji | One handler; inspect full diff |
| **Custom / paid** | Supported triggers for **add** only | Filter queries: `message_reaction:new_reaction:emoji`, etc. |
| **Anonymous channel counts** | No | Use `message_reaction_count` instead (not Mike-bot group path) |

Grammy API reference (`Composer.reaction`):

> `bot.reaction` will trigger if: a new emoji reaction is added …  
> `bot.reaction` will **not** trigger if: a reaction is **removed** …

**Recommendation for Mike-bot v2:** Single `bot.on("message_reaction")` handler (or middleware) that:

1. Reads `ctx.reactions()` or manual diff.
2. Resolves message author from cache.
3. Applies domain guards (no self, no bots, karma exclusivity).
4. Applies Marks for `emojiAdded` ∩ scoring emojis; undoes for `emojiRemoved` ∩ scoring emojis.

Optional: `bot.reaction([karmaPlus, karmaMinus, humor], …)` for logging or fast-path **only if** a parent `message_reaction` handler still handles removes — using `bot.reaction()` alone is **insufficient** for scoring.

---

## Example payloads

### Add Karma plus (apply Mark)

```json
"old_reaction": [],
"new_reaction": [{ "type": "emoji", "emoji": "👍" }]
```

→ `emojiAdded: ["👍"]` → apply Karma plus Mark.

### Remove Karma plus (undo Mark)

```json
"old_reaction": [{ "type": "emoji", "emoji": "👍" }],
"new_reaction": []
```

→ `emojiRemoved: ["👍"]` → undo Karma plus Mark.

### Switch Karma plus → Karma minus

```json
"old_reaction": [{ "type": "emoji", "emoji": "👍" }],
"new_reaction": [{ "type": "emoji", "emoji": "👎" }]
```

→ undo Karma plus, apply Karma minus (one webhook call).

### Add Humor while keeping Karma plus

```json
"old_reaction": [{ "type": "emoji", "emoji": "👍" }],
"new_reaction": [
  { "type": "emoji", "emoji": "👍" },
  { "type": "emoji", "emoji": "🤣" }
]
```

→ `emojiKept: ["👍"]`, `emojiAdded: ["🤣"]` → apply Humor Mark only.

---

## Webhook configuration checklist

```ts
// Grammy — must opt in; not in default allowed_updates
bot.start({
  allowed_updates: ["message", "message_reaction"],
});
// Vercel webhook: same allowed_updates on setWebhook
```

Also subscribe to `message` (or equivalent) so author cache is populated before reactions arrive.

---

## Open items (other tickets)

- **Which three emojis** map to Karma plus, Karma minus, Humor — ticket #05.
- **Author cache storage** — ticket #07 (Marks DB may also store author on apply).
- **Exact karma exclusivity policy** when both appear in `new_reaction` — product call if Telegram clients ever allow it.
