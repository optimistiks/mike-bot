import path from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";

import { schema, type Schema } from "./schema";

const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../drizzle");

export type AppDatabase = ReturnType<typeof drizzlePglite<Schema>>;

export interface PgliteDatabase {
  db: AppDatabase;
  client: PGlite;
}

export async function createPgliteDb(): Promise<PgliteDatabase> {
  const client = new PGlite();
  const db = drizzlePglite({ client, schema });
  await migratePglite(db, { migrationsFolder });
  return { db, client };
}

export async function closePgliteDb({ client }: PgliteDatabase): Promise<void> {
  await client.close();
}
