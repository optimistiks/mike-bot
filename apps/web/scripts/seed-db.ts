#!/usr/bin/env node
/** Reset and populate deterministic local development data. */

import { config as loadDotenv } from "dotenv";
import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { closePgliteDb, createPgliteDb } from "../lib/db/pglite";
import { resetAndSeedDatabase } from "../lib/db/seed";
import { resolveDatabaseSeedTarget } from "../lib/db/seed-target";
import { schema } from "../lib/db/schema";

loadDotenv({ path: [".env.local", ".env"] });

async function main(): Promise<void> {
  const target = resolveDatabaseSeedTarget(process.argv.slice(2));

  if (target.kind === "pglite") {
    const pglite = await createPgliteDb({ dataDir: target.dataDir });
    try {
      await resetAndSeedDatabase(pglite.db);
      console.log(`Reset and seeded local PGlite at ${target.dataDir}.`);
    } finally {
      await closePgliteDb(pglite);
    }
    return;
  }

  console.warn("WARNING: DESTRUCTIVE REMOTE DATABASE RESET REQUESTED.");
  console.warn(`Target: ${new URL(target.databaseUrl).host}`);

  const pool = new Pool({ connectionString: target.databaseUrl });
  const db = drizzleNodePostgres({ client: pool, schema });
  try {
    await resetAndSeedDatabase(db);
    console.log("Reset and seeded remote PostgreSQL database.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
