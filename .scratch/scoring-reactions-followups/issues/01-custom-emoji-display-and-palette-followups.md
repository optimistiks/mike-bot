# 01: Custom emoji display, and what the palette can hold

Status: needs-triage

Four follow-ups from reviewing per-Chat Scoring reactions (ADR-0019) after it landed.
They are separable and carry different statuses; each section says its own.

## A. Custom emoji render as their placeholder, not themselves

**ready-for-agent.**

`reactionFace` in `apps/web/app/(root)/_components/scoring-reactions-editor.tsx` falls
back to `label`, and `label` is the standard emoji Telegram writes into the message
text beneath a `custom_emoji` entity — the character non-Premium clients show. That is
deliberate: taking the placeholder costs no Telegram call, which is what keeps
`/addreaction` network-free. The binding is exact either way, since rows are keyed on
`custom_emoji:<id>`.

It stops being cosmetic as soon as a Chat holds **more than one custom emoji built on
the same placeholder**. Three custom emoji over 👍 render as three identical tiles,
each with the same "custom" dot, in all three Mark groups. An administrator cannot
tell which is which, so binding them is guesswork, and a wrong guess stays invisible
until somebody reacts. With the standard 👍 also in the palette that is four
indistinguishable tiles, one behaving differently from the rest.

Scoring is unaffected throughout — distinct ids resolve to distinct Marks. The feature
is simply unusable for that case, which moves this from polish to incomplete.

**Approach.** `getCustomEmojiStickers([id])` → a `Sticker` carrying `file_id` and
`thumbnail` → `getFile` → stream through an authenticated proxy. The proxy exists in
shape already: `apps/web/app/api/chats/[chatId]/photo/route.ts` authenticates the
Member and streams Telegram bytes without exposing `BOT_TOKEN`, and
`app/(root)/_lib/queries.ts` carries the matching Blob-query pattern in
`chatPhotoOptions` / `memberPhotoOptions`.

What sizes the job:

- **Format.** Static custom emoji are WEBP and drop into an `<img>`. Animated ones are
  TGS (gzipped Lottie JSON, needs a player) or WEBM. The `thumbnail` field gives a
  static still for the animated ones — one `<img>`, no Lottie dependency. That is the
  cheap 80% and probably where to stop.
- **A deleted emoji errors.** Ids are stable, but if the sticker leaves its set the
  call fails rather than returning nothing, so the placeholder must stay as a fallback.
- **Bounded call.** This adds a Telegram round-trip to a request path: use
  `telegramTimeout()`, and see `.scratch/chat-metadata-refresh/issues/01` for why that
  is not optional.
- `getCustomEmojiStickers` does not preserve request order — match on
  `custom_emoji_id`.

**Done when** two custom emoji sharing one placeholder are distinguishable in the
settings screen; a deleted one still renders something; no unbounded Telegram call was
added.

## B. The /addreaction reply has the same problem

**needs-info — blocked on a fact, do not plan work yet.**

`/addreaction <custom emoji>` answers "Реакция 👍 добавлена", so adding three custom
emoji over one placeholder produces three identical confirmations.

A bot can put a custom emoji in a message it sends, as a `custom_emoji` `MessageEntity`
or via `<tg-emoji emoji-id="...">👍</tg-emoji>`, without Premium. **But I believe the
Bot API restricts sending custom-emoji entities to bots that have purchased an
additional username on Fragment.** That is unverified — a one-line check against the
`MessageEntity` section of the Bot API docs — and it decides whether this is actionable
at all. If the restriction is real, close as `wontfix` and rely on A: the Mini App is
where telling custom emoji apart actually matters.

Worth weighing either way: members without Premium see the placeholder in the Chat
regardless, so a reply showing the placeholder matches what most of the group sees
natively. This is a smaller problem than A, not the same problem relocated.

## C. Reconcile the palette row on every /addreaction

**ready-for-agent.**

`addChatReaction` (`apps/web/lib/bot/scoring-reactions.ts`) inserts with
`onConflictDoNothing`, so re-running `/addreaction` on a held reaction refreshes
nothing. That changes little today — a placeholder for a given id is fixed — but starts
to matter once A lands and rows carry display data worth refreshing.

Upsert instead, **scoped to `label`**:

```ts
.onConflictDoUpdate({
  target: [chatScoringReactions.chatId, chatScoringReactions.reactionKey],
  set: { label: input.label },
})
```

**`mark_type` must never be touched.** `onConflictDoNothing` is doing two jobs there,
and only one is about labels: the other stops a repeat `/addreaction 🤡` silently
unbinding a 🤡 already bound to Humor. Scoping the `set` keeps that. There is a test —
"never unbinds a reaction the Chat has already bound" in `scoring-reactions.test.ts`.

**Cost to accept.** With `DO UPDATE` the statement always returns a row, so "added" and
"already present" stop being distinguishable from the write alone. Either collapse both
to one wording, or reinstate the existence read that was removed as redundant when the
palette cap was cut; `AddChatReactionResult` and the answer in `applyFacts` must agree.

Reconciling is not removing: this does nothing about a palette holding rows a group
cannot get rid of. That is D.

## D. Can a built-in reaction be unbound entirely?

**needs-triage — a product call, not a technical one.**

ADR-0019 rests on an invariant: rows are inserted and re-typed, **never deleted**, and
a save materialises a row for each built-in reaction. That is what lets "no rows" mean
"never configured, use 👍👎🤣" even for a Chat that has deliberately bound nothing.

The proposal is to drop the materialisation and let absence of rows simply mean the
defaults.

**What it buys.** The materialise step leaves every save (`replaceChatBindings`); the
never-delete invariant goes, so a **delete affordance becomes safe to add**; two
regression tests guarding "an all-empty save survives a reload" become moot; a
paragraph of ADR-0019 stops needing to exist.

**What it costs.** A Chat could no longer turn a built-in reaction off entirely — only
repoint it. The materialised row is what expresses "👍 is in this palette and bound to
nothing"; without it, "never configured" and "deliberately unbound" are the same state
and the defaults have to win. Binding 👍 to Humor still works; making 👍 score nothing
does not.

Note the narrowness: a Chat that has ever used `/addreaction` holds rows regardless, so
it can unbind everything and score by nothing. The restriction lands only on the three
built-ins.

**So the question is: should a group be able to switch 👎 off, or only move it?** If
disabling is a real want — a group wanting no downvotes at all is plausible — the
current design is buying something. If groups will only ever repoint, the
materialisation defends a state nobody reaches.

My read: the simplification is the better trade. "The built-in three always score
something unless you point them elsewhere" fits in one sentence, and it buys back a
simpler write path and a future delete affordance. But it is a call to make, not a
cleanup to schedule.

**If it goes ahead:** `usingDefaults` stays useful (it tells an administrator they are
looking at built-ins rather than choices), and the "a Mark may have zero reactions
bound" decision from planning becomes narrower than what was originally chosen —
ADR-0019 justifies the never-delete rule at some length and would need rewriting rather
than patching.
