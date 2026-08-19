# Database layer

v2 uses **Neon Postgres** in production and **PGlite** locally (no cloud credentials required).

## Production (Vercel Fluid + Neon)

Use a standard Postgres **TCP** connection with `pg` `Pool`, not the `@neondatabase/serverless` HTTP driver. Vercel Fluid compute makes connection pooling safe: idle connections close before function suspension.

```typescript
import { attachDatabasePool } from '@vercel/functions';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
attachDatabasePool(pool);

export const db = drizzle({ client: pool, schema });
```

See [Neon's Vercel connection methods guide](https://neon.com/docs/guides/vercel-connection-methods) and `getProductionDb()` in `client.ts`.

## Local dev and tests

`createPgliteDb()` spins up in-memory PGlite, runs Drizzle migrations, and returns a client with the same schema as production.

## Tables

| Table | Purpose |
| --- | --- |
| `events` | Append-only scoring log (`type` string, no `value` column) |
| `chat_members` | Display names per (`chat_id`, `user_id`) |
| `chat_memberships` | Mini App chat picker roster |
| `message_authors` | Message author cache for reaction Subject lookup |
| `processed_updates` | Webhook `update_id` deduplication |
