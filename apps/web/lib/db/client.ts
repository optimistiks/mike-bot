import "server-only";

import { attachDatabasePool } from "@vercel/functions";
import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { schema, type Schema } from "./schema";

export type Database = ReturnType<typeof drizzleNodePostgres<Schema>>;

let productionDb: Database | undefined;

/** Production Neon client: TCP `Pool` + Vercel Fluid lifecycle via `attachDatabasePool`. */
export function getProductionDb(connectionString: string): Database {
  if (!productionDb) {
    const pool = new Pool({ connectionString });
    attachDatabasePool(pool);
    productionDb = drizzleNodePostgres({ client: pool, schema });
  }

  return productionDb;
}
