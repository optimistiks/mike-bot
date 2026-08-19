# 29 — Explicit registration (`/register`, pin reactions, leave cleanup)

**Parent:** [v2 spec](../spec.md)

**What to build:** Add `registration_messages` (`chat_id`, `message_id`, `created_at`) via Drizzle migration. Implement admin-only `/register` in groups: post the Russian registration pin, cache the bot message in `message_authors`, insert the registration row. On `message_reaction`, when the cached author is a bot, look up `registration_messages`; any reaction on a registered pin upserts `chat_memberships` for the actor (no `events` row; removal ignored). Remove `my_chat_member` membership sync from the webhook handler; keep `chat_member` only to delete `chat_memberships` on `left`/`kicked`. Table-driven and PGlite integration tests: `/register` → reaction on pin → row in `chat_memberships` → opener sees chat in `/api/chats`.

**Blocked by:** None — can start immediately (supersedes join-sync portions of ticket 25 implementation)

**Status:** resolved

- [x] `registration_messages` table migrated (PGlite + Neon)
- [x] `/register` works for group admins only; Russian error outside groups
- [x] Any reaction on a registered pin creates `chat_memberships` for the actor; no scoring event
- [x] `my_chat_member` handler removed; `chat_member` removes membership on leave/kick only
- [x] Integration test proves registration → chat appears in `/api/chats`

## Answer

Added `registration_messages` (Drizzle `0001_registration_messages.sql`) and `lib/bot/register.ts` with admin-only `/register` (Russian pin + errors), `recordRegistrationPin`, and registration lookup. `handleMessageReactionUpdate` registers actors on any added reaction to a bot-authored pin listed in `registration_messages` (no `events` row; removal ignored). Removed `my_chat_member` sync; `chat_member` only upserts display names and removes `chat_memberships` on leave/kick. Tests: table-driven guards in `register.test.ts`, webhook integration in `handle-update.test.ts`, and `GET /api/chats` in `route.test.ts`.
