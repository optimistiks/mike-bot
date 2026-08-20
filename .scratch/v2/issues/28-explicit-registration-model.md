# How do Members register for Mini App access?

> Historical record: this resolved ticket is not canonical current-state documentation. Its question, answer, and acceptance criteria may now be false; use the Wayfinder map and specification for current behavior.

Type: grilling
Status: resolved

## Question

How does a Member get a row in `chat_memberships` so the Mini App chat picker includes their Chat? Prior ticket 25 synced roster on `my_chat_member` / `chat_member` join — but the bot cannot know all group members on join, and a direct-link Mini App pivot (`chat_instance`) was rejected.

## Answer

**Explicit registration only** — no implicit registration from scoring participation. Marks accumulate in `events` regardless of registration; registration gates Mini App access only.

**Registration message:** A group admin runs `/register`. The bot posts a Russian Registration message (e.g. «Поставьте реакцию на это сообщение, чтобы участвовать в таблице лидеров») and records `(chat_id, message_id)` in a new **`registration_messages`** table. Re-running `/register` adds another row; all Registration messages remain valid.

**Registration act:** Any reaction on a message listed in `registration_messages` upserts `chat_memberships` for the **actor**. Reaction removal is ignored (no unregister). No `events` row is written for registration.

**Reaction fast path:** On `message_reaction`, if `message_authors.author_is_bot` is false → scoring path only. If true → look up `(chat_id, message_id)` in `registration_messages`; if found, register the actor.

**`/register` constraints:** Group/supergroup only; **admins only**; Russian error in private chat or DM.

**Leave cleanup:** On `chat_member` when status is `left` or `kicked`, delete that user's `chat_memberships` row. **No `my_chat_member` handling** — no roster sync on bot join.

**Mini App entry:** Menu Button unchanged (ticket 06). Chat picker lists registered Chats only. Unregistered opener sees a Russian «go register» prompt (react to a Registration message; ask an admin to run `/register`) — not leaderboards.

**Webhook `allowed_updates`:** `message`, `message_reaction`, `chat_member` — drop `my_chat_member`.

**Out of scope for this decision:** Direct-link Mini App entry (`?startapp`, `chat_instance`); implicit registration from Marks; `/app` command.
