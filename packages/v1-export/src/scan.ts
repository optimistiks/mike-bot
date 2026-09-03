import { DynamoDBClient, type DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

import { parseV1Items, type V1LolRow } from "./row.js";

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

export async function scanV1LolTable(options: ScanV1Options): Promise<ScanV1Result> {
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
