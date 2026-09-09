import { z } from "zod";

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

function skippedForItem(item: unknown, rows: V1LolRow[]): number {
  const parsed = v1LolRowSchema.safeParse(item);
  if (parsed.success) {
    rows.push(parsed.data);
    return 0;
  }
  logWarn("Skipping malformed v1 DynamoDB item", {
    issues: parsed.error.issues,
    item,
  });
  return 1;
}

function parseV1Items(items: unknown[]): {
  rows: V1LolRow[];
  skipped: number;
} {
  const rows: V1LolRow[] = [];
  let skipped = 0;
  for (const item of items) {
    skipped += skippedForItem(item, rows);
  }
  return { rows, skipped };
}

export { parseV1Items, v1LolRowSchema, type V1LolRow };
