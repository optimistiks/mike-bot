# 29 — Explicit registration (`/register`, pin reactions, leave cleanup)

**Parent:** [v2 spec](../spec.md)

**What to build:** Add `registration_messages` (`chat_id`, `message_id`, `created_at`) via Drizzle migration. Implement admin-only `/register` in groups: post the Russian registration pin, cache the bot message in `message_authors`, insert the registration row. On `message_reaction`, when the cached author is a bot, look up `registration_messages`; any reaction on a registered pin upserts `chat_memberships` for the actor (no `events` row; removal ignored). Remove `my_chat_member` membership sync from the webhook handler; keep `chat_member` only to delete `chat_memberships` on `left`/`kicked`. Table-driven and PGlite integration tests: `/register` → reaction on pin → row in `chat_memberships` → opener sees chat in `/api/chats`.

**Blocked by:** None — can start immediately (supersedes join-sync portions of ticket 25 implementation)

**Status:** ready-for-agent

- [ ] `registration_messages` table migrated (PGlite + Neon)
- [ ] `/register` works for group admins only; Russian error outside groups
- [ ] Any reaction on a registered pin creates `chat_memberships` for the actor; no scoring event
- [ ] `my_chat_member` handler removed; `chat_member` removes membership on leave/kick only
- [ ] Integration test proves registration → chat appears in `/api/chats`
