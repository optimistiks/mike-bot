import path from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";

import { schema, type Schema } from "./schema";

const migrationsFolder = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../drizzle",
);

export interface PgliteDatabase {
  db: ReturnType<typeof drizzlePglite<Schema>>;
  client: PGlite;
}

export interface CreatePgliteDbOptions {
  migrationsDir?: string;
  /** When set, PGlite persists to this directory instead of in-memory. */
  dataDir?: string;
}

/** Local dev and tests: PGlite with the same schema as production. */
export async function createPgliteDb(
  options: CreatePgliteDbOptions | string = {},
): Promise<PgliteDatabase> {
  const resolved =
    typeof options === "string" ? { migrationsDir: options } : options;
  const migrationsDir = resolved.migrationsDir ?? migrationsFolder;

  const client = resolved.dataDir ? new PGlite(resolved.dataDir) : new PGlite();
  const db = drizzlePglite({ client, schema });
  await migratePglite(db, { migrationsFolder: migrationsDir });
  return { db, client };
}

export async function closePgliteDb({ client }: PgliteDatabase): Promise<void> {
  await client.close();
}
