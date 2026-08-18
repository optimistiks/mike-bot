# Store scoring as typed events, not Telegram-shaped rows

v2 persistence uses an `events` table: each scoring action is a row with `type` (`karma` | `humor`) and `value` (`+1` / `-1` for karma; `+1` for humor). Columns use generic names (`chat_id`, `actor_id`, `subject_id`, `message_id`) — not Telegram field names like `fromUser`.

Undo-on-remove deletes (or revokes) the matching event row.

v1 DynamoDB rows import as-is into `legacy_marks` (v1 shape, `lolType` field). The Mini App maps legacy rows to the same leaderboard math on read — import stays untransformed.

Display names live in `chat_members`, not on event rows.

Future non-Telegram triggers can append new event types without renaming tables.
