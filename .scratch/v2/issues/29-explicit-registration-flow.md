# 29 — Explicit registration (`/register`, Registration-message reactions, leave cleanup)

> Historical record: this resolved ticket is not canonical current-state documentation. Its question, answer, and acceptance criteria may now be false; use the Wayfinder map and specification for current behavior.

**Parent:** [v2 spec](../spec.md)

**What to build:** Add `registration_messages` (`chat_id`, `message_id`, `created_at`) via Drizzle migration. Implement admin-only `/register` in groups: post the Russian Registration message, cache the bot message in `message_authors`, insert the registration row. On `message_reaction`, when the cached author is a bot, look up `registration_messages`; any added reaction on a registered message upserts `chat_memberships` for the actor (no `events` row; removal ignored). Remove `my_chat_member` membership sync from the webhook handler; keep `chat_member` only to delete `chat_memberships` on `left`/`kicked`. Table-driven and PGlite integration tests: `/register` → Registration-message reaction → row in `chat_memberships` → opener sees Chat in `/api/chats`.

**Blocked by:** None — can start immediately (supersedes join-sync portions of ticket 25 implementation)

**Status:** resolved

- [x] `registration_messages` table migrated (PGlite + Neon)
- [x] `/register` works for group admins only; Russian error outside groups
- [x] Any added reaction on a Registration message creates `chat_memberships` for the actor; no scoring Event
- [x] `my_chat_member` handler removed; `chat_member` removes membership on leave/kick only
- [x] Integration test proves registration → chat appears in `/api/chats`

## Answer

Added `registration_messages` (Drizzle `0001_registration_messages.sql`) and the admin-only `/register` flow with Russian copy, `recordRegistrationMessage`, and registration lookup. The reaction handler registers Actors on any added reaction to a bot-authored Registration message listed in `registration_messages` (no `events` row; removal ignored). Removed `my_chat_member` sync; `chat_member` only upserts display names and removes `chat_memberships` on leave/kick. Tests cover command guards, webhook integration, and the Chat picker API.
