import { attachDatabasePool } from "@vercel/functions";
import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { schema, type Schema } from "./schema";

export type ProductionDatabase = ReturnType<typeof drizzleNodePostgres<Schema>>;

let productionDb: ProductionDatabase | undefined;

export function getProductionDb(connectionString: string): ProductionDatabase {
  if (!productionDb) {
    const pool = new Pool({ connectionString });
    attachDatabasePool(pool);
    productionDb = drizzleNodePostgres({ client: pool, schema });
  }

  return productionDb;
}

export function createScriptDb(connectionString: string): {
  db: ProductionDatabase;
  close: () => Promise<void>;
} {
  const pool = new Pool({ connectionString });
  return {
    db: drizzleNodePostgres({ client: pool, schema }),
    close: async () => {
      await pool.end();
    },
  };
}
