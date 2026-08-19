import "server-only";

import type { Database } from "./client";
import { getProductionDb } from "./client";
import { closePgliteDb, createPgliteDb, type PgliteDatabase } from "./pglite";

export type AppDatabase = Database | PgliteDatabase["db"];

let devDb: PgliteDatabase | undefined;

/** Production Neon when `DATABASE_URL` is set; otherwise in-memory PGlite for local dev. */
export async function getRuntimeDb(): Promise<AppDatabase> {
  const connectionString = process.env.DATABASE_URL;

  if (connectionString) {
    return getProductionDb(connectionString);
  }

  devDb ??= await createPgliteDb();

  return devDb.db;
}

export async function resetRuntimeDbForTests(): Promise<void> {
  if (devDb) {
    await closePgliteDb(devDb);
    devDb = undefined;
  }
}
