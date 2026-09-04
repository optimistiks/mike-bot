import type { BotSession, MarkType } from "@mike-bot/bot-core";
import type { V1LolRow } from "@mike-bot/v1-export";

import { markSlotForType, schema } from "@mike-bot/bot-core";
import { v1LolRowSchema } from "@mike-bot/v1-export";

const { marks, members, messages } = schema;

const EMPTY_COUNT = 0;
const MS_PER_SECOND = 1000;

interface ImportedMessage {
  chatId: number;
  messageId: number;
  authorId: number;
  postedAt: Date;
}

const MARK_TYPE_BY_LOL: Record<V1LolRow["lolType"], MarkType> = {
  lol: "humor.add",
  minus: "karma.minus",
  plus: "karma.plus",
};

function convertType(lolType: V1LolRow["lolType"]): MarkType {
  return MARK_TYPE_BY_LOL[lolType];
}

function telegramSecondTruncation(epochMs: number): Date {
  return new Date(Math.floor(epochMs / MS_PER_SECOND) * MS_PER_SECOND);
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

function parseRowAt(item: unknown, index: number): V1LolRow {
  const parsed = v1LolRowSchema.safeParse(item);
  if (!parsed.success) {
    throw new Error(`Invalid v1 row at ${String(index)}`);
  }
  return parsed.data;
}

function parseImportRows(raw: unknown): V1LolRow[] {
  if (!Array.isArray(raw)) {
    throw new TypeError("v1 JSON must be an array of lol rows");
  }
  return raw.map((item, index) => parseRowAt(item, index));
}

function considerMember(
  memberById: Map<number, string | null>,
  telegramUser: { id: number; username?: string },
): void {
  if (telegramUser.username !== undefined) {
    memberById.set(telegramUser.id, telegramUser.username);
    return;
  }
  if (!memberById.has(telegramUser.id)) {
    memberById.set(telegramUser.id, null);
  }
}

function collectMembers(rows: V1LolRow[]): Map<number, string | null> {
  const memberById = new Map<number, string | null>();
  for (const row of rows) {
    considerMember(memberById, row.fromUser);
    considerMember(memberById, row.toUser);
  }
  return memberById;
}

function messageKey(row: V1LolRow): string {
  return `${String(row.chatId)}:${String(row.toMessageId)}`;
}

function newMessage(row: V1LolRow): ImportedMessage {
  return {
    authorId: row.toUser.id,
    chatId: row.chatId,
    messageId: row.toMessageId,
    postedAt: telegramSecondTruncation(row.createdAt),
  };
}

function keepEarlierPostedAt(existing: ImportedMessage, postedAt: Date): void {
  if (postedAt < existing.postedAt) {
    existing.postedAt = postedAt;
  }
}

function upsertMessage(messageByKey: Map<string, ImportedMessage>, row: V1LolRow): void {
  const key = messageKey(row);
  const existing = messageByKey.get(key);
  if (existing === undefined) {
    messageByKey.set(key, newMessage(row));
    return;
  }
  keepEarlierPostedAt(existing, telegramSecondTruncation(row.createdAt));
}

function collectMessages(rows: V1LolRow[]): Map<string, ImportedMessage> {
  const messageByKey = new Map<string, ImportedMessage>();
  for (const row of rows) {
    upsertMessage(messageByKey, row);
  }
  return messageByKey;
}

function keepEarlierWinner(winners: Map<string, V1LolRow>, row: V1LolRow): void {
  const key = slotKey(row);
  const existing = winners.get(key);
  if (existing === undefined || isEarlier(row, existing)) {
    winners.set(key, row);
  }
}

function collectWinners(rows: V1LolRow[]): Map<string, V1LolRow> {
  const winners = new Map<string, V1LolRow>();
  for (const row of rows) {
    keepEarlierWinner(winners, row);
  }
  return winners;
}

async function persistMembers(
  db: BotSession,
  memberById: Map<number, string | null>,
): Promise<number> {
  await Promise.all(
    [...memberById].map(([telegramId, username]) =>
      db.insert(members).values({ telegramId, username }).onConflictDoUpdate({
        set: { username },
        target: members.telegramId,
      }),
    ),
  );
  return memberById.size;
}

async function persistMessages(
  db: BotSession,
  messageByKey: Map<string, ImportedMessage>,
): Promise<number> {
  const results = await Promise.all(
    [...messageByKey.values()].map((message) =>
      db.insert(messages).values(message).onConflictDoNothing().returning(),
    ),
  );
  return results.reduce((sum, inserted) => sum + inserted.length, EMPTY_COUNT);
}

async function persistMarks(db: BotSession, winners: Map<string, V1LolRow>): Promise<number> {
  const results = await Promise.all(
    [...winners.values()].map((row) =>
      db
        .insert(marks)
        .values({
          actorId: row.fromUser.id,
          chatId: row.chatId,
          createdAt: new Date(row.createdAt),
          messageId: row.toMessageId,
          subjectId: row.toUser.id,
          type: convertType(row.lolType),
        })
        .onConflictDoNothing()
        .returning(),
    ),
  );
  return results.reduce((sum, inserted) => sum + inserted.length, EMPTY_COUNT);
}

async function loadImportedRows(
  db: BotSession,
  rows: V1LolRow[],
): Promise<{ members: number; messages: number; marks: number }> {
  const memberById = collectMembers(rows);
  const messageByKey = collectMessages(rows);
  const winners = collectWinners(rows);
  return {
    marks: await persistMarks(db, winners),
    members: await persistMembers(db, memberById),
    messages: await persistMessages(db, messageByKey),
  };
}

export { loadImportedRows, parseImportRows };
