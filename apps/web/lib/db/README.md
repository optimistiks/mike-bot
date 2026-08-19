# Database layer

v2 uses **Lakebase Postgres** (Neon) in production and **PGlite** locally (no cloud credentials required).

Provision production Postgres via **Vercel Marketplace → Neon Postgres** (Vercel-managed integration). Vercel injects `DATABASE_URL` (pooled) for the app and `DATABASE_URL_UNPOOLED` (direct) for migrations — see root `README.md` go-live steps.

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

Local one-shot scripts (`scripts/import-v1.ts`) use `createScriptDb()` — same Drizzle schema, plain `Pool`, no Vercel lifecycle hooks.

## Local dev and tests

`createPgliteDb()` spins up in-memory PGlite, runs Drizzle migrations, and returns a client with the same schema as production.

## Tables

| Table                   | Purpose                                                    |
| ----------------------- | ---------------------------------------------------------- |
| `events`                | Append-only scoring log (`type` string, no `value` column) |
| `chat_members`          | Display names per (`chat_id`, `user_id`)                   |
| `chat_memberships`      | Mini App chat picker roster (explicit registration)        |
| `message_authors`       | Message author cache for reaction Subject lookup           |
| `registration_messages` | Bot-posted registration pins (`/register`)                 |
| `processed_updates`     | Webhook `update_id` deduplication                          |
