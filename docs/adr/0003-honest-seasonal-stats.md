# Honest seasonal leaderboards in the Mini App, no decay

v1 `/stats` applied Humor decay and showed a single all-time board. v2 kills `/stats`. The Mini App shows honest counts (no decay), broken down by Season (calendar month in `Europe/Moscow`, rolled up by year), with Current Season clearly marked. Crown 👑 on #1 and chicken 🐔 on last in each section, like v1.

v2 Marks live in Postgres. v1 DynamoDB `lolTable` is one-shot imported into a **separate** legacy Postgres table, as-is (no transformation, no `source` column). The Mini App queries both tables and presents unified Seasonal leaderboards per `chatId`.
