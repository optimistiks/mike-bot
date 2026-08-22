#!/usr/bin/env node
/**
 * Repeatable v1 DynamoDB reconciliation (ticket 26).
 *
 * Local-only: scans v1 DynamoDB and writes to Neon or PGlite.
 * Not invoked on Vercel runtime.
 *
 * Usage (Neon):
 *   DATABASE_URL=... AWS_REGION=eu-west-1 pnpm import:v1
 *
 * Usage (PGlite dry run + dump):
 *   IMPORT_TARGET=pglite AWS_REGION=eu-west-1 IMPORT_DUMP_DIR=./tmp/import-dump \
 *     pnpm import:v1
 *
 * Optional env:
 *   IMPORT_TARGET=pglite — use PGlite instead of DATABASE_URL
 *   PGLITE_DATA_DIR — persist PGlite files (default: in-memory)
 *   IMPORT_DUMP_DIR — write Events/Messages/identities/leaderboards JSON after import
 *   LOL_TABLE_NAME (default: lolTable)
 *   IMPORT_CHAT_ID (numeric Telegram chat id filter)
 */

import { closePgliteDb, createPgliteDb } from "../lib/db/pglite";
import { createScriptDb } from "../lib/db/production";
import { dumpImportResults } from "../lib/import/dump-results";
import { importV1Rows } from "../lib/import/import-events";
import { scanV1LolTable } from "../lib/import/scan-v1";
import type { AppDatabase } from "../lib/db/runtime";
import type { PgliteDatabase } from "../lib/db/pglite";
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: [".env.local", ".env"] });

function readOptionalChatId(): number | undefined {
  const raw = process.env.IMPORT_CHAT_ID?.trim();
  if (!raw) {
    return undefined;
  }

  const chatId = Number(raw);
  if (!Number.isInteger(chatId)) {
    throw new Error("IMPORT_CHAT_ID must be an integer");
  }

  return chatId;
}

async function scanRows(chatId: number | undefined) {
  const region =
    process.env.AWS_REGION?.trim() ??
    process.env.AWS_DEFAULT_REGION?.trim() ??
    "";
  if (!region) {
    throw new Error("AWS_REGION or AWS_DEFAULT_REGION is required");
  }

  const tableName = process.env.LOL_TABLE_NAME?.trim() ?? "lolTable";
  console.log(`Scanning DynamoDB table ${tableName} in ${region}...`);
  return scanV1LolTable({ tableName, region, chatId });
}

async function openDatabase(): Promise<{
  db: AppDatabase;
  close: () => Promise<void>;
}> {
  if (process.env.IMPORT_TARGET?.trim() === "pglite") {
    const dataDir = process.env.PGLITE_DATA_DIR?.trim();
    const pglite: PgliteDatabase = await createPgliteDb(
      dataDir ? { dataDir } : {},
    );
    console.log(
      dataDir
        ? `Using file-backed PGlite at ${dataDir}.`
        : "Using in-memory PGlite.",
    );
    return {
      db: pglite.db,
      close: async () => closePgliteDb(pglite),
    };
  }

  const databaseUrl =
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "";
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required (set DATABASE_URL or DATABASE_URL_UNPOOLED in .env.local or the shell)",
    );
  }
  return createScriptDb(databaseUrl);
}

async function main(): Promise<void> {
  const chatId = readOptionalChatId();
  const scan = await scanRows(chatId);
  const rows = scan.rows;
  console.log(`Fetched ${String(rows.length)} v1 rows.`);
  console.log(`Skipped ${String(scan.skipped)} malformed v1 rows.`);

  const { db, close } = await openDatabase();

  try {
    const stats = await importV1Rows(db, rows);

    console.log("Import complete:");
    console.log(`  rows processed: ${String(stats.rowsProcessed)}`);
    for (const [label, counts] of [
      ["events", stats.events],
      ["messages", stats.messages],
      ["display identities", stats.displayIdentities],
    ] as const) {
      console.log(`  ${label}:`);
      console.log(`    inserted: ${String(counts.inserted)}`);
      console.log(`    updated: ${String(counts.updated)}`);
      console.log(`    unchanged: ${String(counts.unchanged)}`);
      console.log(`    skipped: ${String(counts.skipped)}`);
    }

    const dumpDir = process.env.IMPORT_DUMP_DIR?.trim();
    if (dumpDir) {
      const chatIds = chatId === undefined ? undefined : [chatId];
      const files = await dumpImportResults(db, {
        outDir: dumpDir,
        chatIds,
      });
      console.log("Wrote verification dump:");
      for (const file of files) {
        console.log(`  ${file}`);
      }
    }
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
