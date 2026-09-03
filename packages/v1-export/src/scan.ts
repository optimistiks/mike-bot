import type { DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

import type { V1LolRow } from "./row.js";

import { EMPTY_COUNT } from "./constants.js";
import { parseV1Items } from "./row.js";

interface ScanV1Options {
  tableName: string;
  region: string;
  chatId?: number;
  clientConfig?: DynamoDBClientConfig;
}

interface ScanV1Result {
  rows: V1LolRow[];
  skipped: number;
}

type ExclusiveStartKey = Record<string, unknown>;

interface ScanPage {
  lastKey: ExclusiveStartKey | undefined;
  page: { rows: V1LolRow[]; skipped: number };
}

function documentClient(options: ScanV1Options): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: options.region, ...options.clientConfig }),
  );
}

function chatFilter(chatId: number | undefined): {
  ExpressionAttributeValues?: { ":chatId": number };
  FilterExpression?: string;
} {
  if (chatId === undefined) {
    return {};
  }
  return {
    ExpressionAttributeValues: { ":chatId": chatId },
    FilterExpression: "chatId = :chatId",
  };
}

function pageItems(items: unknown[] | undefined): unknown[] {
  return items ?? [];
}

async function scanPage(
  client: DynamoDBDocumentClient,
  options: ScanV1Options,
  exclusiveStartKey: ExclusiveStartKey | undefined,
): Promise<ScanPage> {
  const output = await client.send(
    new ScanCommand({
      ExclusiveStartKey: exclusiveStartKey,
      TableName: options.tableName,
      ...chatFilter(options.chatId),
    }),
  );
  return {
    lastKey: output.LastEvaluatedKey,
    page: parseV1Items(pageItems(output.Items)),
  };
}

async function scanV1LolTable(options: ScanV1Options): Promise<ScanV1Result> {
  const client = documentClient(options);
  const rows: V1LolRow[] = [];
  let skipped = EMPTY_COUNT;
  let exclusiveStartKey: ExclusiveStartKey | undefined = undefined;

  do {
    // eslint-disable-next-line no-await-in-loop -- DynamoDB Scan pages must be fetched sequentially
    const { lastKey, page } = await scanPage(client, options, exclusiveStartKey);
    rows.push(...page.rows);
    skipped += page.skipped;
    exclusiveStartKey = lastKey;
  } while (exclusiveStartKey !== undefined);

  return { rows, skipped };
}

export { scanV1LolTable, type ScanV1Options, type ScanV1Result };
