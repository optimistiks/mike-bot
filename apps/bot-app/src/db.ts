import "server-only";
import { schema } from "@mike-bot/bot-core";
import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "@/env";

const pool = new Pool({ connectionString: env.DATABASE_URL });
attachDatabasePool(pool);

const db = drizzle({ client: pool, schema });

export { db };
