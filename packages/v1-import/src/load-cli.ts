#!/usr/bin/env node
/**
 * Load validated v1 lol-row JSON into members, messages, and marks.
 *
 * Generates batched `INSERT ... ON CONFLICT DO NOTHING` SQL in memory, then
 * runs one statement per round trip — no wrapping transaction. Conflicts are
 * resolved while generating, so a killed run resumes by re-running.
 *
 *   pnpm load
 *   pnpm v1-import   # from the repo root
 *
 * Optional: IMPORT_JSON (default <repo>/tmp/v1-rows.json), IMPORT_BATCH_SIZE
 * (rows per INSERT, default 1000). Uses DATABASE_URL_UNPOOLED, then DATABASE_URL.
 */

import { config as loadDotenv } from "dotenv";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createScriptClient } from "./db.js";
import { importBatchSize, importJsonPath, unpooledDatabaseUrl } from "./env.js";
import { parseImportRows } from "./load.js";
import { logError, logInfo } from "./log.js";
import { buildImportSql, splitStatements } from "./sql.js";

loadDotenv({ path: [".env.local", ".env"] });

function elapsedSeconds(startedAt: number): string {
  return ((Date.now() - startedAt) / 1000).toFixed(1);
}

async function executeStatements(
  client: ReturnType<typeof createScriptClient>,
  statements: string[],
): Promise<void> {
  const startedAt = Date.now();
  for (const [index, statement] of statements.entries()) {
    // eslint-disable-next-line no-await-in-loop -- each statement is its own implicit transaction
    const result = await client.query(statement);
    logInfo(
      `  [${String(index + 1)}/${String(statements.length)}] ${String(result.rowCount ?? 0)} rows inserted (${elapsedSeconds(startedAt)}s)`,
    );
  }
}

async function main(): Promise<void> {
  const connectionString = unpooledDatabaseUrl();
  if (connectionString === "") {
    throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL is required");
  }

  const file = path.resolve(
    importJsonPath() ?? path.join(import.meta.dirname, "../../../tmp/v1-rows.json"),
  );
  const raw: unknown = JSON.parse(await readFile(file, "utf8"));
  const rows = parseImportRows(raw);
  const batchSize = importBatchSize();
  const { sql, stats } = buildImportSql(rows, batchSize === undefined ? {} : { batchSize });
  const statements = splitStatements(sql);

  logInfo(
    `Executing ${String(statements.length)} statements (members=${String(stats.members)} messages=${String(stats.messages)} marks=${String(stats.marks)})...`,
  );

  const client = createScriptClient(connectionString);
  await client.connect();
  try {
    await executeStatements(client, statements);
    logInfo(
      `Loaded members=${String(stats.members)} messages=${String(stats.messages)} marks=${String(stats.marks)}`,
    );
  } finally {
    await client.end();
  }
}

try {
  // eslint-disable-next-line node/no-top-level-await -- ESM script entry, never require()'d
  await main();
} catch (error: unknown) {
  logError("v1-import load failed", error);
  process.exitCode = 1;
}
