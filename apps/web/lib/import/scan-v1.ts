import {
  DynamoDBClient,
  type DynamoDBClientConfig,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

import { v1LolRowSchema, type V1LolRow } from "./v1-row";

export interface ScanV1Options {
  tableName: string;
  region: string;
  chatId?: number;
  clientConfig?: DynamoDBClientConfig;
}

export interface ScanV1Result {
  rows: V1LolRow[];
  skipped: number;
}

export function parseV1Items(items: unknown[]): ScanV1Result {
  const rows: V1LolRow[] = [];
  let skipped = 0;

  for (const item of items) {
    const parsed = v1LolRowSchema.safeParse(item);
    if (parsed.success) {
      rows.push(parsed.data);
    } else {
      skipped += 1;
      console.warn("Skipping malformed v1 DynamoDB item", {
        issues: parsed.error.issues,
        item,
      });
    }
  }

  return { rows, skipped };
}

export async function scanV1LolTable(
  options: ScanV1Options,
): Promise<ScanV1Result> {
  const client = DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: options.region, ...options.clientConfig }),
  );

  const rows: V1LolRow[] = [];
  let skipped = 0;
  let exclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const output = await client.send(
      new ScanCommand({
        TableName: options.tableName,
        ExclusiveStartKey: exclusiveStartKey,
        ...(options.chatId === undefined
          ? {}
          : {
              FilterExpression: "chatId = :chatId",
              ExpressionAttributeValues: { ":chatId": options.chatId },
            }),
      }),
    );

    const page = parseV1Items(output.Items ?? []);
    rows.push(...page.rows);
    skipped += page.skipped;

    exclusiveStartKey = output.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return { rows, skipped };
}
