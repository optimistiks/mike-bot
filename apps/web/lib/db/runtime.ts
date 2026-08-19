import "server-only";

import type { Database } from "./client";
import { getProductionDb } from "./client";
import { closePgliteDb, createPgliteDb, type PgliteDatabase } from "./pglite";
import { resolveLocalPgliteDataDir } from "./seed-target";

export type AppDatabase = Database | PgliteDatabase["db"];

let devDb: PgliteDatabase | undefined;

/** Production Postgres when configured; otherwise shared file-backed PGlite locally. */
export async function getRuntimeDb(): Promise<AppDatabase> {
  const connectionString = process.env.DATABASE_URL;

  if (connectionString) {
    return getProductionDb(connectionString);
  }

  devDb ??= await createPgliteDb(
    process.env.NODE_ENV === "test"
      ? {}
      : { dataDir: resolveLocalPgliteDataDir() },
  );

  return devDb.db;
}

export async function resetRuntimeDbForTests(): Promise<void> {
  if (devDb) {
    await closePgliteDb(devDb);
    devDb = undefined;
  }
}
