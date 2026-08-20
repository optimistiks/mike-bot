# Honest seasonal leaderboards in the Mini App, no decay

v1 `/stats` applied Humor decay and showed a single all-time board. v2 kills `/stats`. The Mini App shows honest counts (no decay), broken down by Season (calendar month in `Europe/Moscow`, rolled up by year), with Current Season clearly marked. Crown 👑 on #1 and chicken 🐔 on last in each section, like v1.

All scoring lives in Postgres table `events` (typed event strings, no value column — see ADR-0004). v1 DynamoDB history is imported once into the same Event store with a stable deduplication key. The Mini App queries that one store only. Aggregation lives in application code, while display names remain separate presentation data.
