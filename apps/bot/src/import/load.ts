import { v1LolRowSchema, type V1LolRow } from "@mike-bot/v1-export";

import type { MarkType } from "../domain/mark";
import { markSlotForType } from "../domain/mark";
import type { BotSession } from "../db/runtime";
import { marks, members, messages } from "../db/schema";
import { telegramSecondTruncation } from "../telegram/identity";

function convertType(lolType: V1LolRow["lolType"]): MarkType {
  switch (lolType) {
    case "plus":
      return "karma.plus";
    case "minus":
      return "karma.minus";
    case "lol":
      return "humor.add";
    default: {
      const exhausted: never = lolType;
      throw new Error(`unknown lolType ${String(exhausted)}`);
    }
  }
}

function isEarlier(row: V1LolRow, than: V1LolRow): boolean {
  if (row.createdAt !== than.createdAt) {
    return row.createdAt < than.createdAt;
  }
  return row.id < than.id;
}

function slotKey(row: V1LolRow): string {
  const type = convertType(row.lolType);
  return `${String(row.chatId)}:${String(row.fromUser.id)}:${String(row.toMessageId)}:${markSlotForType(type)}`;
}

export function parseImportRows(raw: unknown): V1LolRow[] {
  if (!Array.isArray(raw)) {
    throw new Error("v1 JSON must be an array of lol rows");
  }
  return raw.map((item, index) => {
    const parsed = v1LolRowSchema.safeParse(item);
    if (!parsed.success) {
      throw new Error(`Invalid v1 row at ${String(index)}`);
    }
    return parsed.data;
  });
}

export async function loadImportedRows(
  db: BotSession,
  rows: V1LolRow[],
): Promise<{ members: number; messages: number; marks: number }> {
  const memberById = new Map<number, { username: string | null; createdAt: number }>();
  for (const row of rows) {
    considerMember(memberById, row.fromUser, row.createdAt);
    considerMember(memberById, row.toUser, row.createdAt);
  }

  const messageByKey = new Map<
    string,
    { chatId: number; messageId: number; authorId: number; postedAt: Date }
  >();
  for (const row of rows) {
    const key = `${String(row.chatId)}:${String(row.toMessageId)}`;
    const postedAt = telegramSecondTruncation(row.createdAt);
    const existing = messageByKey.get(key);
    if (existing === undefined) {
      messageByKey.set(key, {
        chatId: row.chatId,
        messageId: row.toMessageId,
        authorId: row.toUser.id,
        postedAt,
      });
      continue;
    }
    if (postedAt < existing.postedAt) {
      existing.postedAt = postedAt;
    }
  }

  const winners = new Map<string, V1LolRow>();
  for (const row of rows) {
    const key = slotKey(row);
    const existing = winners.get(key);
    if (existing === undefined || isEarlier(row, existing)) {
      winners.set(key, row);
    }
  }

  for (const [telegramId, seen] of memberById) {
    await db
      .insert(members)
      .values({ telegramId, username: seen.username })
      .onConflictDoUpdate({
        target: members.telegramId,
        set: { username: seen.username },
      });
  }

  let messageCount = 0;
  for (const message of messageByKey.values()) {
    const inserted = await db.insert(messages).values(message).onConflictDoNothing().returning();
    messageCount += inserted.length;
  }

  let markCount = 0;
  for (const row of winners.values()) {
    const inserted = await db
      .insert(marks)
      .values({
        chatId: row.chatId,
        actorId: row.fromUser.id,
        subjectId: row.toUser.id,
        messageId: row.toMessageId,
        type: convertType(row.lolType),
        createdAt: new Date(row.createdAt),
      })
      .onConflictDoNothing()
      .returning();
    markCount += inserted.length;
  }

  return {
    members: memberById.size,
    messages: messageCount,
    marks: markCount,
  };
}

function considerMember(
  memberById: Map<number, { username: string | null; createdAt: number }>,
  user: { id: number; username?: string },
  createdAt: number,
): void {
  const existing = memberById.get(user.id);
  if (existing === undefined || createdAt >= existing.createdAt) {
    memberById.set(user.id, {
      username: user.username ?? null,
      createdAt,
    });
  }
}
