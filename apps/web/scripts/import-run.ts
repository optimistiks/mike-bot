#!/usr/bin/env node
/**
 * Step 3 of the v1 import: execute the SQL file.
 *
 * Sends one statement per round trip, each in its own implicit transaction, and
 * prints progress as it goes. Kill it whenever — every statement is
 * `ON CONFLICT DO NOTHING`, so re-running resumes.
 *
 * `psql -f tmp/v1-import.sql` does the same thing if you have psql installed;
 * this script exists so the pipeline needs no system dependencies.
 *
 * Usage:
 *   DATABASE_URL=... pnpm import:run
 *
 * Optional env:
 *   IMPORT_SQL — input path (default: ./tmp/v1-import.sql)
 */

import { readFile } from "node:fs/promises";

import { config as loadDotenv } from "dotenv";
import { Client } from "pg";

import { splitStatements } from "../lib/import/sql-file";

import { requireDatabaseUrl, resolvePath } from "./import-env";

loadDotenv({ path: [".env.local", ".env"] });

async function main(): Promise<void> {
  const inFile = resolvePath(process.env.IMPORT_SQL, "tmp/v1-import.sql");
  const statements = splitStatements(await readFile(inFile, "utf8"));
  console.log(
    `Executing ${String(statements.length)} statements from ${inFile}...`,
  );

  const client = new Client({ connectionString: requireDatabaseUrl() });
  await client.connect();

  const startedAt = Date.now();
  try {
    for (const [index, statement] of statements.entries()) {
      const result = await client.query(statement);
      const elapsed = ((Date.now() - startedAt) / 1_000).toFixed(1);
      console.log(
        `  [${String(index + 1)}/${String(statements.length)}] ${String(result.rowCount ?? 0)} rows inserted (${elapsed}s)`,
      );
    }
  } finally {
    await client.end();
  }

  console.log("Done.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
