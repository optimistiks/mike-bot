#!/usr/bin/env node
/**
 * One-shot v1 DynamoDB import (ticket 26).
 *
 * Local-only: requires temporary AWS credentials and DATABASE_URL.
 * Not invoked on Vercel runtime.
 *
 * Usage:
 *   DATABASE_URL=... AWS_REGION=eu-west-1 pnpm --filter @mike-bot/web import:v1
 *
 * Optional env:
 *   LOL_TABLE_NAME (default: lolTable)
 *   IMPORT_CHAT_ID (numeric Telegram chat id filter)
 */

import { createScriptDb } from "../lib/db/production";
import { importV1Rows } from "../lib/import/import-events";
import { scanV1LolTable } from "../lib/import/scan-v1";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

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

async function main(): Promise<void> {
  const databaseUrl = requireEnv("DATABASE_URL");
  const region =
    process.env.AWS_REGION?.trim() ??
    process.env.AWS_DEFAULT_REGION?.trim() ??
    "";
  if (!region) {
    throw new Error("AWS_REGION or AWS_DEFAULT_REGION is required");
  }

  const tableName = process.env.LOL_TABLE_NAME?.trim() ?? "lolTable";
  const chatId = readOptionalChatId();

  console.log(`Scanning DynamoDB table ${tableName} in ${region}...`);
  const rows = await scanV1LolTable({ tableName, region, chatId });
  console.log(`Fetched ${String(rows.length)} v1 rows.`);

  const db = createScriptDb(databaseUrl);
  const stats = await importV1Rows(db, rows);

  console.log("Import complete:");
  console.log(`  rows processed: ${String(stats.rowsProcessed)}`);
  console.log(`  events inserted: ${String(stats.eventsInserted)}`);
  console.log(
    `  events skipped (legacy_id conflict): ${String(stats.eventsSkipped)}`,
  );
  console.log(`  chat_members upserts: ${String(stats.membersUpserted)}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
