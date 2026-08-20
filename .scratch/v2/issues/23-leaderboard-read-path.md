# 23 — Leaderboard read path (scoring, API, minimal UI)

> Historical record: this resolved ticket is not canonical current-state documentation. Its question, answer, and acceptance criteria may now be false; use the Wayfinder map and specification for current behavior.

**Parent:** [v2 spec](../spec.md)

**What to build:** The shared scoring module with full unit tests — the primary test seam. Given Event records, it buckets by Season in `Europe/Moscow`, applies the bucket matrix (including undo types and net Karma for «Уважаемые люди»), and returns five ranked Russian leaderboard sections with crown/chicken metadata. A thin leaderboard API Route Handler queries `events` for a `chat_id` and Season via Drizzle, runs aggregation, joins `chat_members` for display names, and returns JSON validated with Zod. A minimal Mini App page renders the five sections from seeded fixture data (hardcoded or test chat — no chat picker yet). Verifiable locally end-to-end: seed Events in PGlite → API or page shows «Уважаемые люди», «Юмористы», «Поставили +», «Поставили −», «Поставили лол».

**Blocked by:** [22 — Monorepo scaffold and Postgres foundation](22-monorepo-scaffold-and-postgres-foundation.md)

**Status:** resolved

- [x] Scoring module exports event type constants, `eventTypeToContributions`, and `aggregateLeaderboard` per spec bucket matrix
- [x] Unit tests cover Season boundaries (`Europe/Moscow`), undo inversion, net Karma, five sections, crown on #1 and chicken on last — no Telegram or DB in tests
- [x] Leaderboard API accepts `chat_id` and Season; response shape validated with Zod
- [x] Minimal Mini App page displays five Russian sections from seeded data (Current Season)
- [x] Display names come from `chat_members` join, not Event rows

## Answer

Implemented `lib/scoring/` (bucket matrix, Season bucketing in `Europe/Moscow`, five ranked sections with crown/chicken), `lib/leaderboard/` query layer with Zod-validated `/api/leaderboard`, PGlite fixture seed, and a minimal Russian Mini App home page rendering Current Season leaderboards for a hardcoded test chat.
