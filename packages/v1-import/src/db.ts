import type { Schema } from "@mike-bot/bot-core";

import { schema } from "@mike-bot/bot-core";
import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

type ImportDatabase = ReturnType<typeof drizzleNodePostgres<Schema>>;

function createScriptDb(connectionString: string): {
  db: ImportDatabase;
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

export { createScriptDb };
