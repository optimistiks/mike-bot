# How does v1 DynamoDB import into events?

> Historical record: this resolved ticket is not canonical current-state documentation. Its question, answer, and acceptance criteria may now be false; use the Wayfinder map and specification for current behavior.

Type: grilling
Status: resolved
Blocked by: 17

## Question

[Legacy read mapping](17-legacy-read-mapping.md) decided: one-shot Scan, convert each v1 row to an `events` row (`plus`→`karma.plus`, etc.). What still needs deciding?

- Idempotency — re-run safe? (e.g. store v1 `id` on the event row, or deterministic import batch)
- `chat_members` seeding — still from import, but from converted events or a side pass over DynamoDB users?
- Drop `legacy_marks` from schema — confirm no other consumer needs raw v1 shape

## Answer

**No `legacy_marks` table.** v1 history lives entirely as converted rows in `events`.

**Idempotency:** optional `legacy_id` column on `events` (v1 DynamoDB UUID), UNIQUE. Import uses `ON CONFLICT (legacy_id) DO NOTHING` — re-run safe.

**`chat_members` seeding:** same import script upserts `fromUser` and `toUser` into `chat_members` (`chat_id`, `user_id`, `username`) alongside event inserts.

**Run locally:** `scripts/import-v1.ts` — one-shot Scan with temporary AWS creds, not Vercel runtime. Per [Read v1 DynamoDB](03-read-v1-dynamodb.md).

**Preserve timestamps:** `created_at` = v1 `createdAt`; Seasons bucket in `Europe/Moscow`.

**No `source` column:** imported rows are normal events; `legacy_id` set. Live v2 events have `legacy_id = NULL`.

Field mapping per [Legacy read mapping](17-legacy-read-mapping.md): `plus`→`karma.plus`, `minus`→`karma.minus`, `lol`→`humor.add`; `fromUser.id`→`actor_id`, `toUser.id`→`subject_id`, `chatId`→`chat_id`, `toMessageId`→`message_id`.
