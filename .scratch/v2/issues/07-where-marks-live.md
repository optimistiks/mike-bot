# Where do v2 Marks live?

Type: grilling
Status: resolved

## Question

Vercel has no DynamoDB. Where do we persist v2 Marks so the Mini App can query honest Seasonal breakdowns (and later join v1 history)? Recommendation: Postgres (Neon or Vercel Postgres) with one row per Mark, timestamped, so Seasons are queries. Reject: stuffing counts into Grammy session JSON as the source of truth.

## Answer

Postgres on Neon. Five tables (+ dedup):

- **`events`** — append-only v2 log: `type` string only (e.g. `karma.plus`, `karma.undo.minus`, `humor.add` — no `value` column), plus `chat_id`, `actor_id`, `subject_id`, `message_id`, `created_at`. Scoring weights live in application code. Never delete rows. See ADR-0004.
- **`legacy_marks`** — v1 DynamoDB import as-is (`lolType`, `fromUser`, `toUser`, …). Mapped to leaderboard math on read, not on import.
- **`chat_members`** — (`chat_id`, `user_id`) → latest display name.
- **`chat_memberships`** — (`chat_id`, `user_id`) roster for Mini App chat picker; synced on join/leave. See ADR-0005.
- **`message_authors`** — (`chat_id`, `message_id`) → `author_id`, `author_is_bot`, `message_date`; populated from `message` updates. See ADR-0005.
- **`processed_updates`** — `update_id` for webhook dedup. See ADR-0005.
