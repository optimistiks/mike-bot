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

Leaderboards aggregate by counting or weighting event types in `lib/scoring/`. Event types are enforced by the application rather than a database constraint, so adding an Event type does not require a schema migration.

v1 DynamoDB rows are converted to Events on a one-shot import (`plus`→`karma.plus`, `minus`→`karma.minus`, `lol`→`humor.add`). Their source IDs populate `legacy_id` so retries are idempotent; there is no separate legacy table or live DynamoDB read path.

Display names live in `chat_members`. Chat roster for the Mini App picker lives in `chat_memberships` (ADR-0005).

Webhook handlers claim Telegram `update_id` and apply the update's database effects in one transaction. A failed update rolls back its claim so Telegram can retry it safely.
