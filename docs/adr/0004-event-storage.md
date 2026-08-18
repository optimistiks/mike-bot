# Store scoring as typed events, not Telegram-shaped rows

v2 persistence uses an append-only `events` table. Each reaction change appends a row — **events are never updated or deleted**.

Each row: `type` (`karma` | `humor`) and `value` (the score delta applied to `subject_id`). Examples:

| Action | Event |
| --- | --- |
| Add 👍 | `karma`, `+1` |
| Remove 👍 | `karma`, `-1` |
| Add 👎 | `karma`, `-1` |
| Remove 👎 | `karma`, `+1` |
| Add 🤣 | `humor`, `+1` |
| Remove 🤣 | `humor`, `-1` |

Leaderboards are `SUM(value)` grouped by `type`, `subject_id`, and Season. The full history of adds and removes is always queryable.

Columns use generic names (`chat_id`, `actor_id`, `subject_id`, `message_id`, `created_at`) — not Telegram field names.

v1 DynamoDB rows import as-is into `legacy_marks`. The Mini App maps legacy rows to the same leaderboard math on read — import stays untransformed.

Display names live in `chat_members`, not on event rows.

Future non-Telegram triggers append new event types without renaming tables.
