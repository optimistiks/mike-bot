# 26 — v1 DynamoDB one-shot import

**Parent:** [v2 spec](../spec.md)

**What to build:** A local-only `import-v1.ts` script that Scans v1 DynamoDB `lolTable` with temporary AWS credentials, converts each row to an Event (`plus`→`karma.plus`, `minus`→`karma.minus`, `lol`→`humor.add`), maps actor/subject/chat/message/timestamp fields, sets `legacy_id` for idempotency (`ON CONFLICT DO NOTHING`), and upserts `chat_members` from v1 `fromUser`/`toUser`. Re-run is safe. Imported Events appear in seasonal leaderboard views via the ticket 23 API. Script is not invoked on Vercel runtime.

**Blocked by:** [23 — Leaderboard read path](23-leaderboard-read-path.md)

**Status:** ready-for-agent

- [ ] Script Scans `lolTable` and inserts converted Events via Drizzle
- [ ] `legacy_id` UNIQUE constraint makes re-import idempotent
- [ ] `chat_members` seeded from v1 actors and subjects in the same run
- [ ] v1 `created_at` preserved and buckets correctly in `Europe/Moscow` Seasons
- [ ] Imported history visible in leaderboard API for appropriate Season filters
- [ ] Script documented as local-only; requires temporary AWS creds, not Neon/Vercel secrets beyond `DATABASE_URL`
