# Database layer

v2 uses **Lakebase Postgres** (Neon) in production and **PGlite** locally (no cloud credentials required).

Provision production Postgres via **Vercel Marketplace → Neon Postgres** (Vercel-managed integration). Vercel injects `DATABASE_URL` (pooled) for the app and `DATABASE_URL_UNPOOLED` (direct) for `drizzle-kit migrate` — see root `README.md` go-live steps.

## Migrations (Drizzle)

| Environment       | Pattern                                                                                   | How                                                                                                                                         |
| ----------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Neon / production | [Option 3](https://orm.drizzle.team/docs/migrations) — `generate` + `drizzle-kit migrate` | From `apps/web`, run `vercel env pull .env.local` then `pnpm db:migrate` (reads `.env.local`, then `.env`; prefers `DATABASE_URL_UNPOOLED`) |
| PGlite tests      | Option 4 — runtime migrator on same SQL files                                             | `createPgliteDb()` in `pglite.ts`                                                                                                           |

Schema changes: edit `lib/db/schema.ts` → `pnpm db:generate` → commit `drizzle/` → `pnpm db:migrate` on each database.

## Production (Vercel Fluid + Neon)

Use a standard Postgres **TCP** connection with `pg` `Pool`, not the `@neondatabase/serverless` HTTP driver. Vercel Fluid compute makes connection pooling safe: idle connections close before function suspension.

```typescript
import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
attachDatabasePool(pool);

export const db = drizzle({ client: pool, schema });
```

See [Neon's Vercel connection methods guide](https://neon.com/docs/guides/vercel-connection-methods) and `getProductionDb()` in `production.ts` (re-exported from `client.ts` with `server-only`).

Local one-shot scripts (`scripts/import-v1.ts`) use `createScriptDb()` — same Drizzle schema, plain `Pool`, explicit close, and no Vercel lifecycle hooks.

## Local development and seed data

From `apps/web`, `pnpm db:seed` migrates, resets, and populates the same
file-backed PGlite database used by `pnpm dev`. Its default directory is
`.data/pglite`; set `PGLITE_DATA_DIR` to choose another location. The fixture is
deterministic and covers registered, unregistered, and forbidden personas plus
the Current and previous Moscow Seasons.

Remote reset is deliberately awkward and destructive:

```bash
ALLOW_REMOTE_DATABASE_SEED=1 pnpm db:seed -- --remote
```

The remote path prefers `DATABASE_URL_UNPOOLED`, falls back to `DATABASE_URL`,
and prints a warning before connecting. Without the opt-in flag it refuses to
run. Tests continue to use isolated in-memory PGlite through `createPgliteDb()`.

## Tables

| Table                   | Purpose                                                    |
| ----------------------- | ---------------------------------------------------------- |
| `events`                | Append-only scoring log (`type` string, no `value` column) |
| `chat_members`          | Display names per (`chat_id`, `user_id`)                   |
| `chat_memberships`      | Mini App chat picker roster (explicit registration)        |
| `message_authors`       | Message author cache for reaction Subject lookup           |
| `registration_messages` | Bot-posted Registration messages (`/register`)             |
| `processed_updates`     | Webhook `update_id` deduplication                          |
