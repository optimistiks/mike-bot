# Store scoring as typed events, not Telegram-shaped rows

v2 persistence uses an append-only `events` table. Each reaction change appends one row — **events are never updated or deleted**.

Each row has a single `type` string (no numeric `value` column). Scoring weights live in application code, not the schema.

| Telegram action | Event `type` |
| --- | --- |
| Add 👍 | `karma.add` |
| Remove 👍 | `karma.undo.add` |
| Add 👎 | `karma.remove` |
| Remove 👎 | `karma.undo.remove` |
| Add 🤣 | `humor.add` |
| Remove 🤣 | `humor.undo.add` |

Other columns: `chat_id`, `actor_id`, `subject_id`, `message_id`, `created_at` — generic names, not Telegram field names.

Leaderboards aggregate by counting or weighting event types in code. New event types can be added without schema migrations.

v1 DynamoDB rows import as-is into `legacy_marks`. The Mini App maps legacy rows to leaderboard math on read — import stays untransformed.

Display names live in `chat_members`, not on event rows.
