#!/usr/bin/env node
/**
 * Step 2 of the v1 import: JSON file -> SQL file.
 *
 * Pure text transformation: no AWS, no database. Every conflict is resolved in
 * memory, so the output is plain `INSERT ... ON CONFLICT DO NOTHING` batches.
 *
 * Usage:
 *   pnpm import:sql
 *
 * Optional env:
 *   IMPORT_JSON — input path (default: ./tmp/v1-rows.json)
 *   IMPORT_SQL — output path (default: ./tmp/v1-import.sql)
 *   IMPORT_BATCH_SIZE — rows per INSERT statement (default: 1000)
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseV1Items } from "../lib/import/scan-v1";
import { buildImportSql } from "../lib/import/sql-file";

import { resolvePath } from "./import-env";

function readBatchSize(): number | undefined {
  const raw = process.env.IMPORT_BATCH_SIZE?.trim();
  if (!raw) {
    return undefined;
  }

  const batchSize = Number(raw);
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error("IMPORT_BATCH_SIZE must be a positive integer");
  }

  return batchSize;
}

async function main(): Promise<void> {
  const inFile = resolvePath(process.env.IMPORT_JSON, "tmp/v1-rows.json");
  const outFile = resolvePath(process.env.IMPORT_SQL, "tmp/v1-import.sql");
  const batchSize = readBatchSize();

  const raw: unknown = JSON.parse(await readFile(inFile, "utf8"));
  if (!Array.isArray(raw)) {
    throw new Error(`${inFile} must contain an array of v1 rows`);
  }

  const parsed = parseV1Items(raw);
  if (parsed.skipped > 0) {
    console.warn(`Skipped ${String(parsed.skipped)} malformed rows.`);
  }

  const { sql, stats, skipped } = buildImportSql(
    parsed.rows,
    batchSize === undefined ? {} : { batchSize },
  );

  await mkdir(path.dirname(outFile), { recursive: true });
  await writeFile(outFile, sql, "utf8");

  console.log(`Wrote ${outFile}`);
  console.log(`  rows processed: ${String(stats.rowsProcessed)}`);
  console.log(`  display identities: ${String(stats.displayIdentities)}`);
  console.log(`  messages: ${String(stats.messages)}`);
  console.log(`  marks: ${String(stats.marks)}`);
  console.log(`  skipped messages: ${String(stats.skippedMessages)}`);
  console.log(`  skipped marks: ${String(stats.skippedMarks)}`);
  console.log(`  statements: ${String(stats.statements)}`);

  for (const message of skipped.messages) {
    console.warn("Skipped v1 Message with conflicting source authors", {
      chatId: message.chatId,
      messageId: message.messageId,
      authorIds: message.authorIds,
    });
  }

  for (const row of skipped.marks) {
    console.warn("Skipped v1 row: the Actor already spent that grant", {
      chatId: row.chatId,
      actorId: row.fromUser.id,
      messageId: row.toMessageId,
      lolType: row.lolType,
      legacyId: row.id,
    });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
