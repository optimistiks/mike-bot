# 26 — v1 DynamoDB one-shot import

**Parent:** [v2 spec](../spec.md)

**What to build:** A local-only `import-v1.ts` script that Scans v1 DynamoDB `lolTable` with temporary AWS credentials, converts each row to an Event (`plus`→`karma.plus`, `minus`→`karma.minus`, `lol`→`humor.add`), maps actor/subject/chat/message/timestamp fields, sets `legacy_id` for idempotency (`ON CONFLICT DO NOTHING`), and upserts `chat_members` from v1 `fromUser`/`toUser`. Re-run is safe. Imported Events appear in seasonal leaderboard views via the ticket 23 API. Script is not invoked on Vercel runtime.

**Blocked by:** [23 — Leaderboard read path](23-leaderboard-read-path.md)

**Status:** resolved

- [x] Script Scans `lolTable` and inserts converted Events via Drizzle
- [x] `legacy_id` UNIQUE constraint makes re-import idempotent
- [x] `chat_members` seeded from v1 actors and subjects in the same run
- [x] v1 `created_at` preserved and buckets correctly in `Europe/Moscow` Seasons
- [x] Imported history visible in leaderboard API for appropriate Season filters
- [x] Script documented as local-only; requires temporary AWS creds, not Neon/Vercel secrets beyond `DATABASE_URL`

## Answer

Added `apps/web/scripts/import-v1.ts` (run via `pnpm --filter @mike-bot/web import:v1`) with `lib/import/` modules:

- `v1-row.ts` — v1 row validation and conversion (`plus`→`karma.plus`, etc.)
- `scan-v1.ts` — paginated DynamoDB Scan of `lolTable`
- `import-events.ts` — Drizzle insert with `legacy_id` idempotency + `chat_members` upsert

Tests cover conversion, idempotency, and Moscow season bucketing via `queryLeaderboard`. AWS SDK is a devDependency; script uses `createScriptDb()` (plain Pool, no Vercel hooks).

Env: `DATABASE_URL`, `AWS_REGION`, optional `LOL_TABLE_NAME`, `IMPORT_CHAT_ID`.
