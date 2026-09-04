import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import path from "node:path";

import type { Schema } from "./schema.js";

import { schema } from "./schema.js";

const migrationsFolder = path.join(import.meta.dirname, "../../../drizzle");

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

export { closePgliteDb, createPgliteDb, type AppDatabase, type PgliteDatabase };
