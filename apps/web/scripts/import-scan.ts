#!/usr/bin/env node
/**
 * Step 1 of the v1 import: DynamoDB -> JSON file.
 *
 * Local-only. Needs AWS credentials; touches no database.
 *
 * Usage:
 *   AWS_REGION=eu-west-1 pnpm import:scan
 *
 * Optional env:
 *   IMPORT_JSON — output path (default: ./tmp/v1-rows.json)
 *   LOL_TABLE_NAME (default: lolTable)
 *   IMPORT_CHAT_ID (numeric Telegram chat id filter)
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { config as loadDotenv } from "dotenv";

import { scanV1LolTable } from "../lib/import/scan-v1";

import { readOptionalChatId, resolvePath } from "./import-env";

loadDotenv({ path: [".env.local", ".env"] });

async function main(): Promise<void> {
  const region =
    process.env.AWS_REGION?.trim() ??
    process.env.AWS_DEFAULT_REGION?.trim() ??
    "";
  if (!region) {
    throw new Error("AWS_REGION or AWS_DEFAULT_REGION is required");
  }

  const tableName = process.env.LOL_TABLE_NAME?.trim() ?? "lolTable";
  const outFile = resolvePath(process.env.IMPORT_JSON, "tmp/v1-rows.json");
  const chatId = readOptionalChatId();

  console.log(`Scanning DynamoDB table ${tableName} in ${region}...`);
  const scan = await scanV1LolTable({ tableName, region, chatId });
  console.log(`Fetched ${String(scan.rows.length)} v1 rows.`);
  console.log(`Skipped ${String(scan.skipped)} malformed v1 rows.`);

  await mkdir(path.dirname(outFile), { recursive: true });
  await writeFile(outFile, `${JSON.stringify(scan.rows, null, 2)}\n`, "utf8");
  console.log(`Wrote ${outFile}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
