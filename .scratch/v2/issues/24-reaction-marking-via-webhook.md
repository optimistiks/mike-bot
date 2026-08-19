# 24 — Reaction Marking via webhook

**Parent:** [v2 spec](../spec.md)

**What to build:** A Grammy bot wired to a POST webhook Route Handler (`webhookCallback` with `std/http` and `secretToken`). On `message` updates, upsert `message_authors` (author id, bot flag, date only — no text/media). On `message_reaction`, diff old/new reactions to append the correct Event type (👍👎🤣 add and undo types); enforce no self-Marking, no bot subjects, Karma plus/minus mutual exclusivity, Humor independent; upsert `chat_members` for Actor and Subject; dedupe via `processed_updates`. The bot stays silent in the group. Table-driven adapter tests cover reaction diff → event type and skip conditions; one PGlite integration test sends a synthetic Telegram update and asserts an Event row appears. That Event shows up on the ticket 23 leaderboard API/page.

**Blocked by:** [22 — Monorepo scaffold and Postgres foundation](22-monorepo-scaffold-and-postgres-foundation.md), [23 — Leaderboard read path](23-leaderboard-read-path.md)

**Status:** claimed

- [ ] Webhook Route Handler validates secret token and returns 2xx for valid updates
- [ ] Reaction add/remove maps to the six Event types; undo appends undo types, never deletes rows
- [ ] Business rules skip self-Marks, bot subjects, and uncached messages (console.log only, no group message)
- [ ] Duplicate `update_id` ignored via `processed_updates`
- [ ] Adapter tests and one webhook integration test pass against PGlite
- [ ] Synthetic 👍 on a cached message → `karma.plus` Event visible via leaderboard read path
