import { z } from "zod";

const v1LolTypeSchema = z.enum(["plus", "minus", "lol"]);

const v1UserSchema = z.object({
  id: z.number().int(),
  username: z.string().optional(),
});

export const v1LolRowSchema = z.object({
  id: z.uuid(),
  createdAt: z.number().int().nonnegative(),
  lolType: v1LolTypeSchema,
  fromUser: v1UserSchema,
  toUser: v1UserSchema,
  chatId: z.number().int(),
  toMessageId: z.number().int(),
});

export type V1LolRow = z.infer<typeof v1LolRowSchema>;

export function parseV1LolRow(item: unknown): V1LolRow {
  return v1LolRowSchema.parse(item);
}

export function parseV1Items(items: unknown[]): {
  rows: V1LolRow[];
  skipped: number;
} {
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
