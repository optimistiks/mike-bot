#!/usr/bin/env node
/**
 * Verification dump after an import: Events, Messages, identities, and
 * Leaderboards as JSON, read straight from the database.
 *
 * Usage:
 *   DATABASE_URL=... pnpm import:dump
 *
 * Optional env:
 *   IMPORT_DUMP_DIR — output directory (default: ./tmp/import-dump)
 *   IMPORT_CHAT_ID — restrict the dump to one Chat
 */

import { config as loadDotenv } from "dotenv";

import { createScriptDb } from "../lib/db/production";
import { dumpImportResults } from "../lib/import/dump-results";

import {
  readOptionalChatId,
  requireDatabaseUrl,
  resolvePath,
} from "./import-env";

loadDotenv({ path: [".env.local", ".env"] });

async function main(): Promise<void> {
  const outDir = resolvePath(process.env.IMPORT_DUMP_DIR, "tmp/import-dump");
  const chatId = readOptionalChatId();
  const { db, close } = createScriptDb(requireDatabaseUrl());

  try {
    const files = await dumpImportResults(db, {
      outDir,
      ...(chatId === undefined ? {} : { chatIds: [chatId] }),
    });
    console.log("Wrote verification dump:");
    for (const file of files) {
      console.log(`  ${file}`);
    }
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
