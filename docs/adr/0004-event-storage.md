# Store scoring as typed events, not Telegram-shaped rows

v2 persistence uses an append-only `events` table. Each reaction change appends one row — **events are never updated or deleted**.

Each row has a single `type` string (no numeric `value` column). Scoring weights live in application code, not the schema.

| Telegram action | Event `type`       |
| --------------- | ------------------ |
| Add 👍          | `karma.plus`       |
| Remove 👍       | `karma.undo.plus`  |
| Add 👎          | `karma.minus`      |
| Remove 👎       | `karma.undo.minus` |
| Add 🤣          | `humor.add`        |
| Remove 🤣       | `humor.undo.add`   |

Other columns: `chat_id`, `actor_id`, `subject_id`, `message_id`, `created_at`, optional `legacy_id` (UNIQUE, v1 DynamoDB UUID for idempotent import) — generic names, not Telegram field names.

`subject_id` is the message author. Telegram's `MessageReactionUpdated.user` is the reactor (`actor_id`), not the author — see `message_authors` cache (ADR-0005).

Leaderboards aggregate by counting or weighting event types in `lib/scoring/`. New event types can be added without schema migrations.

v1 DynamoDB rows are converted to `events` on import (`plus`→`karma.plus`, etc.); see `.scratch/v2/issues/17-legacy-read-mapping.md` and `21-v1-import-into-events.md`. No separate legacy table.

Display names live in `chat_members`. Chat roster for the Mini App picker lives in `chat_memberships` (ADR-0005).

Webhook handlers dedupe on Telegram `update_id` before appending events.
