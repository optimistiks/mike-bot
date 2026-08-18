# 22 — Monorepo scaffold and Postgres foundation

**Parent:** [v2 spec](../spec.md)

**What to build:** A Turborepo monorepo on the `v2` branch with a Next.js App Router app as the Vercel deploy target. All five Postgres tables (`events`, `chat_members`, `chat_memberships`, `message_authors`, `processed_updates`) are defined in Drizzle schema with migrations applied. Production connects to Neon over **standard Postgres TCP with connection pooling** on Vercel Fluid compute — the recommended “new way” per [Neon’s Vercel connection guide](https://neon.com/docs/guides/vercel-connection-methods): `pg` `Pool` + `attachDatabasePool` from `@vercel/functions` + Drizzle (`drizzle-orm/node-postgres`). Local dev and tests use PGlite so no Neon credentials, AWS keys, or Vercel secrets are required to build. Zod validates env vars and shared API/event shapes at boundaries. v1 `src/` remains in the repo but is excluded from the v2 Turborepo build graph.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] Turborepo root (`turbo.json`, workspace `package.json`) and `apps/web` Next.js App Router app scaffolded; `turbo build` passes
- [ ] Drizzle schema covers all five tables per spec (append-only `events` with typed `type` string, optional UNIQUE `legacy_id`; no `value` column)
- [ ] Drizzle migrations apply cleanly against PGlite locally
- [ ] Database client module: Neon production path uses TCP `Pool` + `attachDatabasePool` + Drizzle; local/test path uses PGlite with the same schema
- [ ] Zod schemas for server env vars (`BOT_TOKEN`, `BOT_WEBHOOK_SECRET`, `DATABASE_URL`) and core domain records (Event row shape, event type enum)
- [ ] v1 Telegraf code under existing `src/` is not part of the v2 workspace build
- [ ] README or inline docs note: Neon via Vercel Fluid TCP pooling (not `@neondatabase/serverless` HTTP driver) for production
