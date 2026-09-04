import { attachDatabasePool } from "@vercel/functions";
import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import type { Schema } from "#src/bot/index.js";

import { schema } from "#src/bot/index.js";

type ProductionDatabase = ReturnType<typeof drizzleNodePostgres<Schema>>;

// eslint-disable-next-line init-declarations -- assigned on first getProductionPool call
let productionPool: Pool | undefined;

function getProductionPool(connectionString: string): Pool {
  if (productionPool === undefined) {
    productionPool = new Pool({ connectionString });
    attachDatabasePool(productionPool);
  }

  return productionPool;
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

export { createScriptDb, getProductionPool };
