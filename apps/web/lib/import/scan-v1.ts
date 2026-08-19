import {
  DynamoDBClient,
  type DynamoDBClientConfig,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

import { parseV1LolRow, type V1LolRow } from "./v1-row";

export interface ScanV1Options {
  tableName: string;
  region: string;
  chatId?: number;
  clientConfig?: DynamoDBClientConfig;
}

export async function scanV1LolTable(
  options: ScanV1Options,
): Promise<V1LolRow[]> {
  const client = DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: options.region, ...options.clientConfig }),
  );

  const rows: V1LolRow[] = [];
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

    for (const item of output.Items ?? []) {
      rows.push(parseV1LolRow(item));
    }

    exclusiveStartKey = output.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return rows;
}
