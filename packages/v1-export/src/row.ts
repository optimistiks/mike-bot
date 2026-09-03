import { z } from "zod";

import { EMPTY_COUNT, SINGLE_COUNT } from "./constants.js";
import { logWarn } from "./log.js";

const v1LolTypeSchema = z.enum(["plus", "minus", "lol"]);

const v1UserSchema = z.object({
  id: z.number().int(),
  username: z.string().optional(),
});

const v1LolRowSchema = z.object({
  chatId: z.number().int(),
  createdAt: z.number().int().nonnegative(),
  fromUser: v1UserSchema,
  id: z.uuid(),
  lolType: v1LolTypeSchema,
  toMessageId: z.number().int(),
  toUser: v1UserSchema,
});

type V1LolRow = z.infer<typeof v1LolRowSchema>;

function parseV1LolRow(item: unknown): V1LolRow {
  return v1LolRowSchema.parse(item);
}

function skippedForItem(item: unknown, rows: V1LolRow[]): number {
  const parsed = v1LolRowSchema.safeParse(item);
  if (parsed.success) {
    rows.push(parsed.data);
    return EMPTY_COUNT;
  }
  logWarn("Skipping malformed v1 DynamoDB item", {
    issues: parsed.error.issues,
    item,
  });
  return SINGLE_COUNT;
}

function parseV1Items(items: unknown[]): {
  rows: V1LolRow[];
  skipped: number;
} {
  const rows: V1LolRow[] = [];
  let skipped = EMPTY_COUNT;
  for (const item of items) {
    skipped += skippedForItem(item, rows);
  }
  return { rows, skipped };
}

export { parseV1Items, parseV1LolRow, v1LolRowSchema, type V1LolRow };
