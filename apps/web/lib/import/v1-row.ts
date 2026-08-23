import { z } from "zod";

import type { MarkSource, MarkType } from "@/lib/domain/mark";

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

export interface ImportedMarkRow {
  type: MarkType;
  chatId: number;
  actorId: number;
  subjectId: number;
  messageId: number;
  createdAt: Date;
  source: Extract<MarkSource, "reply">;
  legacyId: string;
}

export interface ImportedDisplayIdentityRow {
  chatId: number;
  userId: number;
  displayName: string;
}

export interface ConvertedV1Row {
  mark: ImportedMarkRow;
  displayIdentities: ImportedDisplayIdentityRow[];
}

export function v1DisplayName(user: { id: number; username?: string }): string {
  return user.username ? `@${user.username}` : `User ${String(user.id)}`;
}

export function convertV1LolType(lolType: V1LolRow["lolType"]): MarkType {
  switch (lolType) {
    case "plus":
      return "karma.plus";
    case "minus":
      return "karma.minus";
    case "lol":
      return "humor.add";
  }
}

export function convertV1Row(row: V1LolRow): ConvertedV1Row {
  const chatId = row.chatId;

  return {
    mark: {
      type: convertV1LolType(row.lolType),
      chatId,
      actorId: row.fromUser.id,
      subjectId: row.toUser.id,
      messageId: row.toMessageId,
      createdAt: new Date(row.createdAt),
      source: "reply",
      legacyId: row.id,
    },
    displayIdentities: [
      {
        chatId,
        userId: row.fromUser.id,
        displayName: v1DisplayName(row.fromUser),
      },
      {
        chatId,
        userId: row.toUser.id,
        displayName: v1DisplayName(row.toUser),
      },
    ],
  };
}

/** Parse a DynamoDB DocumentClient item into a validated v1 row. */
export function parseV1LolRow(item: unknown): V1LolRow {
  return v1LolRowSchema.parse(item);
}
