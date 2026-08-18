# Honest seasonal leaderboards in the Mini App, no decay

v1 `/stats` applied Humor decay and showed a single all-time board. v2 kills `/stats`. The Mini App shows honest counts (no decay), broken down by Season (calendar month in `Europe/Moscow`, rolled up by year), with Current Season clearly marked. Crown 👑 on #1 and chicken 🐔 on last in each section, like v1.

All scoring lives in Postgres table `events` (typed event strings, no value column — see ADR-0004). v1 DynamoDB `lolTable` is one-shot imported into `events` with `legacy_id` set (see `.scratch/v2/issues/21-v1-import-into-events.md`). The Mini App queries `events` only. Aggregation in `lib/scoring/`. Display names in `chat_members`.
