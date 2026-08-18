# 23 — Leaderboard read path (scoring, API, minimal UI)

**Parent:** [v2 spec](../spec.md)

**What to build:** The shared scoring module with full unit tests — the primary test seam. Given Event records, it buckets by Season in `Europe/Moscow`, applies the bucket matrix (including undo types and net Karma for «Уважаемые люди»), and returns five ranked Russian leaderboard sections with crown/chicken metadata. A thin leaderboard API Route Handler queries `events` for a `chat_id` and Season via Drizzle, runs aggregation, joins `chat_members` for display names, and returns JSON validated with Zod. A minimal Mini App page renders the five sections from seeded fixture data (hardcoded or test chat — no chat picker yet). Verifiable locally end-to-end: seed Events in PGlite → API or page shows «Уважаемые люди», «Юмористы», «Поставили +», «Поставили −», «Поставили лол».

**Blocked by:** [22 — Monorepo scaffold and Postgres foundation](22-monorepo-scaffold-and-postgres-foundation.md)

**Status:** ready-for-agent

- [ ] Scoring module exports event type constants, `eventTypeToContributions`, and `aggregateLeaderboard` per spec bucket matrix
- [ ] Unit tests cover Season boundaries (`Europe/Moscow`), undo inversion, net Karma, five sections, crown on #1 and chicken on last — no Telegram or DB in tests
- [ ] Leaderboard API accepts `chat_id` and Season; response shape validated with Zod
- [ ] Minimal Mini App page displays five Russian sections from seeded data (Current Season)
- [ ] Display names come from `chat_members` join, not Event rows
