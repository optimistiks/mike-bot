#!/usr/bin/env node
/**
 * Load validated v1 lol-row JSON into members, messages, and marks.
 *
 *   pnpm load
 *   pnpm v1-import   # from the repo root
 *
 * Optional: IMPORT_JSON (default <repo>/tmp/v1-rows.json)
 * Uses DATABASE_URL_UNPOOLED, then DATABASE_URL.
 */

import { config as loadDotenv } from "dotenv";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createScriptDb } from "./db.js";
import { importJsonPath, unpooledDatabaseUrl } from "./env.js";
import { loadImportedRows, parseImportRows } from "./load.js";
import { logError, logInfo } from "./log.js";

loadDotenv({ path: [".env.local", ".env"] });

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

  const { db, close } = createScriptDb(connectionString);
  try {
    const stats = await loadImportedRows(db, rows);
    logInfo(
      `Loaded members=${String(stats.members)} messages=${String(stats.messages)} marks=${String(stats.marks)}`,
    );
  } finally {
    await close();
  }
}

try {
  // eslint-disable-next-line node/no-top-level-await -- ESM script entry, never require()'d
  await main();
} catch (error: unknown) {
  logError("v1-import load failed", error);
  process.exitCode = 1;
}
