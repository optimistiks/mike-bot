import { PGlite } from "@electric-sql/pglite";
import { getTableName } from "drizzle-orm";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import path from "node:path";

import type { Schema } from "./schema.js";

import { schema } from "./schema.js";

const truncateAllTablesSql = `TRUNCATE ${Object.values(schema)
  .map((table) => `"${getTableName(table)}"`)
  .join(", ")} RESTART IDENTITY CASCADE`;

const migrationsFolder = path.join(import.meta.dirname, "../../drizzle");

type AppDatabase = ReturnType<typeof drizzlePglite<Schema>>;

interface PgliteDatabase {
  db: AppDatabase;
  client: PGlite;
}

async function createPgliteDb(): Promise<PgliteDatabase> {
  const client = new PGlite();
  const db = drizzlePglite({ client, schema });
  await migratePglite(db, { migrationsFolder });
  return { client, db };
}

async function closePgliteDb({ client }: PgliteDatabase): Promise<void> {
  await client.close();
}

async function resetPgliteDb({ client }: PgliteDatabase): Promise<void> {
  await client.exec(truncateAllTablesSql);
}

export { closePgliteDb, createPgliteDb, resetPgliteDb, type AppDatabase, type PgliteDatabase };
