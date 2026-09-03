#!/usr/bin/env node
/**
 * Scan v1 DynamoDB lolTable into validated JSON. Does not touch Postgres.
 *
 *   AWS_REGION=eu-west-1 pnpm scan
 *   AWS_REGION=eu-west-1 pnpm v1-export   # from the repo root
 *
 * Optional: LOL_TABLE_NAME, IMPORT_JSON, IMPORT_CHAT_ID
 * Default JSON path is <repo>/tmp/v1-rows.json, not the process cwd.
 */

import { config as loadDotenv } from "dotenv";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { JSON_INDENT } from "./constants.js";
import { importChatIdRaw, importJsonPath, lolTableName, requireAwsRegion } from "./env.js";
import { logError, logInfo } from "./log.js";
import { scanV1LolTable } from "./scan.js";

loadDotenv({ path: [".env.local", ".env"] });

function parseChatId(raw: string): number {
  const chatId = Number(raw);
  if (!Number.isInteger(chatId)) {
    throw new TypeError("IMPORT_CHAT_ID must be an integer");
  }
  return chatId;
}

function optionalChatId(): number | undefined {
  const raw = importChatIdRaw();
  if (raw === undefined) {
    return undefined;
  }
  return parseChatId(raw);
}

function resolvedOutFile(): string {
  return path.resolve(
    importJsonPath() ?? path.join(import.meta.dirname, "../../../tmp/v1-rows.json"),
  );
}

async function writeRows(outFile: string, rows: unknown[]): Promise<void> {
  await mkdir(path.dirname(outFile), { recursive: true });
  await writeFile(outFile, `${JSON.stringify(rows, null, JSON_INDENT)}\n`, "utf8");
}

async function main(): Promise<void> {
  const region = requireAwsRegion();
  const tableName = lolTableName();
  const outFile = resolvedOutFile();
  logInfo(`Scanning DynamoDB table ${tableName} in ${region}...`);
  const scan = await scanV1LolTable({ chatId: optionalChatId(), region, tableName });
  logInfo(`Fetched ${String(scan.rows.length)} v1 rows.`);
  logInfo(`Skipped ${String(scan.skipped)} malformed v1 rows.`);
  await writeRows(outFile, scan.rows);
  logInfo(`Wrote ${outFile}`);
}

try {
  // eslint-disable-next-line node/no-top-level-await -- ESM script entry, never require()'d
  await main();
} catch (error: unknown) {
  logError("v1-export scan failed", error);
  process.exitCode = 1;
}
