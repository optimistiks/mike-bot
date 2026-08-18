# Honest seasonal leaderboards in the Mini App, no decay

v1 `/stats` applied Humor decay and showed a single all-time board. v2 kills `/stats`. The Mini App shows honest counts (no decay), broken down by Season (calendar month in `Europe/Moscow`, rolled up by year), with Current Season clearly marked. Crown 👑 on #1 and chicken 🐔 on last in each section, like v1.

v2 scoring lives in Postgres table `events` (`type` + `value`, generic ids — see ADR-0004). v1 DynamoDB `lolTable` imports as-is into `legacy_marks`. The Mini App queries both and presents unified Seasonal leaderboards per `chat_id`. Display names in `chat_members`.
