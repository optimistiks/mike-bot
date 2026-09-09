import type { MarkType } from "@mike-bot/bot-core";
import type { V1LolRow } from "@mike-bot/v1-export";

import { markSlotForType } from "@mike-bot/bot-core";

/**
 * Statement separator. Emitted on its own line so the runner can split the SQL
 * without parsing it, and ignored by Postgres as a comment.
 */
const STATEMENT_SEPARATOR = "-- statement --";

const DEFAULT_BATCH_SIZE = 1000;
const MS_PER_SECOND = 1000;

interface BuildImportSqlOptions {
  /** Rows per INSERT statement. */
  batchSize?: number;
}

interface BuildImportSqlStats {
  marks: number;
  members: number;
  messages: number;
  rowsProcessed: number;
  statements: number;
}

interface BuildImportSqlResult {
  sql: string;
  stats: BuildImportSqlStats;
}

interface ImportedMessage {
  authorId: number;
  chatId: number;
  messageId: number;
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

function quote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlString(value: string | null): string {
  if (value === null) {
    return "NULL";
  }
  return quote(value);
}

function timestamp(date: Date): string {
  return quote(date.toISOString());
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

function memberTuple([telegramId, username]: [number, string | null]): string {
  return `(${String(telegramId)}, ${sqlString(username)})`;
}

function messageTuple(message: ImportedMessage): string {
  return `(${String(message.chatId)}, ${String(message.messageId)}, ${String(message.authorId)}, ${timestamp(message.postedAt)})`;
}

function markTuple(row: V1LolRow): string {
  return `(${String(row.fromUser.id)}, ${String(row.chatId)}, ${timestamp(new Date(row.createdAt))}, ${String(row.toMessageId)}, ${String(row.toUser.id)}, ${quote(convertType(row.lolType))})`;
}

function insertStatements(
  table: string,
  columns: string[],
  tuples: string[],
  conflictTarget: string,
  batchSize: number,
): string[] {
  const statements: string[] = [];

  for (let start = 0; start < tuples.length; start += batchSize) {
    const batch = tuples.slice(start, start + batchSize);
    statements.push(
      `INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(", ")})\nVALUES\n  ${batch.join(",\n  ")}\nON CONFLICT (${conflictTarget}) DO NOTHING;`,
    );
  }

  return statements;
}

function memberInserts(
  rows: V1LolRow[],
  batchSize: number,
): { statements: string[]; count: number } {
  const tuples = [...collectMembers(rows)].map((entry) => memberTuple(entry));
  return {
    count: tuples.length,
    statements: insertStatements(
      "members",
      ["telegram_id", "username"],
      tuples,
      '"telegram_id"',
      batchSize,
    ),
  };
}

function messageInserts(
  rows: V1LolRow[],
  batchSize: number,
): { statements: string[]; count: number } {
  const tuples = [...collectMessages(rows).values()].map((message) => messageTuple(message));
  return {
    count: tuples.length,
    statements: insertStatements(
      "messages",
      ["chat_id", "message_id", "author_id", "posted_at"],
      tuples,
      '"chat_id", "message_id"',
      batchSize,
    ),
  };
}

function markInserts(rows: V1LolRow[], batchSize: number): { statements: string[]; count: number } {
  const tuples = [...collectWinners(rows).values()].map((row) => markTuple(row));
  return {
    count: tuples.length,
    statements: insertStatements(
      "marks",
      ["actor_id", "chat_id", "created_at", "message_id", "subject_id", "type"],
      tuples,
      '"chat_id", "actor_id", "message_id", "slot"',
      batchSize,
    ),
  };
}

/**
 * Render v1 rows as plain, idempotent INSERT statements.
 *
 * Every conflict is resolved in memory, so the SQL needs no reads and no
 * wrapping transaction: `ON CONFLICT DO NOTHING` makes a re-run — or a resumed
 * run after a kill — land on exactly the same state.
 */
function buildImportSql(
  rows: V1LolRow[],
  options: BuildImportSqlOptions = {},
): BuildImportSqlResult {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const membersSql = memberInserts(rows, batchSize);
  const messagesSql = messageInserts(rows, batchSize);
  const marksSql = markInserts(rows, batchSize);
  const statements = [...membersSql.statements, ...messagesSql.statements, ...marksSql.statements];

  const header = [
    "-- Generated by v1-import. Plain inserts, no wrapping transaction:",
    "-- every statement is idempotent, so a killed run resumes by re-running.",
    `-- rows: ${String(rows.length)}, members: ${String(membersSql.count)}, messages: ${String(messagesSql.count)}, marks: ${String(marksSql.count)}`,
  ].join("\n");

  const sql = `${header}\n${STATEMENT_SEPARATOR}\n${statements.join(`\n${STATEMENT_SEPARATOR}\n`)}\n`;

  return {
    sql,
    stats: {
      marks: marksSql.count,
      members: membersSql.count,
      messages: messagesSql.count,
      rowsProcessed: rows.length,
      statements: statements.length,
    },
  };
}

/** Split generated SQL back into executable statements. */
function splitStatements(sql: string): string[] {
  return sql
    .split(STATEMENT_SEPARATOR)
    .map((chunk) =>
      chunk
        .split("\n")
        .filter((line) => !line.startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((statement) => statement.length > 0);
}

export { buildImportSql, splitStatements, type BuildImportSqlOptions };
