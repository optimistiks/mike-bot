#!/usr/bin/env node
/**
 * Scan v1 DynamoDB lolTable into validated JSON. Does not touch Postgres.
 *
 *   AWS_REGION=eu-west-1 pnpm scan
 *
 * Optional: LOL_TABLE_NAME, IMPORT_JSON, IMPORT_CHAT_ID
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { config as loadDotenv } from "dotenv";

import { scanV1LolTable } from "./scan";

loadDotenv({ path: [".env.local", ".env"] });

async function main(): Promise<void> {
  const region = process.env.AWS_REGION?.trim() ?? process.env.AWS_DEFAULT_REGION?.trim() ?? "";
  if (!region) {
    throw new Error("AWS_REGION or AWS_DEFAULT_REGION is required");
  }

  const tableName = process.env.LOL_TABLE_NAME?.trim() ?? "lolTable";
  const outFile = path.resolve(process.env.IMPORT_JSON ?? "tmp/v1-rows.json");
  const chatIdRaw = process.env.IMPORT_CHAT_ID?.trim();
  const chatId = chatIdRaw === undefined || chatIdRaw === "" ? undefined : Number(chatIdRaw);

  if (chatId !== undefined && !Number.isInteger(chatId)) {
    throw new Error("IMPORT_CHAT_ID must be an integer");
  }

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
