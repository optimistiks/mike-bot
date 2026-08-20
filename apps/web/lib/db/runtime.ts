import "server-only";

import type { Database } from "./client";
import { getProductionDb } from "./client";
import { parseDatabaseUrl } from "../env.server";
import { closePgliteDb, createPgliteDb, type PgliteDatabase } from "./pglite";
import { resolveLocalPgliteDataDir } from "./seed-target";

export type AppDatabase = Database | PgliteDatabase["db"];

let devDb: PgliteDatabase | undefined;

/** Isolated PGlite in tests; configured Postgres or file-backed PGlite otherwise. */
export async function getRuntimeDb(): Promise<AppDatabase> {
  if (process.env.NODE_ENV === "test") {
    devDb ??= await createPgliteDb();
    return devDb.db;
  }

  const connectionString = process.env.DATABASE_URL?.trim();

  if (connectionString) {
    return getProductionDb(connectionString);
  }

  if (process.env.NODE_ENV === "production") {
    return getProductionDb(parseDatabaseUrl());
  }

  devDb ??= await createPgliteDb({ dataDir: resolveLocalPgliteDataDir() });

  return devDb.db;
}

export async function resetRuntimeDbForTests(): Promise<void> {
  if (devDb) {
    await closePgliteDb(devDb);
    devDb = undefined;
  }
}
