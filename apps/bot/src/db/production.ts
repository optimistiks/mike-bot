import { attachDatabasePool } from "@vercel/functions";
import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import type { Schema } from "./schema.js";

import { schema } from "./schema.js";

type ProductionDatabase = ReturnType<typeof drizzleNodePostgres<Schema>>;

// eslint-disable-next-line init-declarations -- assigned on first getProductionDb call
let productionDb: ProductionDatabase | undefined;

function getProductionDb(connectionString: string): ProductionDatabase {
  if (productionDb === undefined) {
    const pool = new Pool({ connectionString });
    attachDatabasePool(pool);
    productionDb = drizzleNodePostgres({ client: pool, schema });
  }

  return productionDb;
}

function createScriptDb(connectionString: string): {
  db: ProductionDatabase;
  close: () => Promise<void>;
} {
  const pool = new Pool({ connectionString });
  return {
    close: async () => {
      await pool.end();
    },
    db: drizzleNodePostgres({ client: pool, schema }),
  };
}

export { createScriptDb, getProductionDb, type ProductionDatabase };
