import { convertV1Row, type V1LolRow } from "./v1-row";

import { markSlotForType } from "@/lib/domain/mark";

/**
 * Statement separator. Emitted on its own line so the runner can split the file
 * without parsing SQL, and ignored by psql as a comment.
 */
export const STATEMENT_SEPARATOR = "-- statement --";

export interface BuildImportSqlOptions {
  /** Rows per INSERT statement. */
  batchSize?: number;
}

export interface BuildImportSqlStats {
  rowsProcessed: number;
  marks: number;
  messages: number;
  displayIdentities: number;
  skippedMessages: number;
  skippedMarks: number;
  statements: number;
}

/** What the transformation left out, for the caller to report as it likes. */
export interface BuildImportSqlSkipped {
  /** v1 rows whose grant was already spent by an earlier row. */
  marks: V1LolRow[];
  /** Messages whose v1 rows disagree about who wrote them. */
  messages: { chatId: number; messageId: number; authorIds: number[] }[];
}

export interface BuildImportSqlResult {
  sql: string;
  stats: BuildImportSqlStats;
  skipped: BuildImportSqlSkipped;
}

/** The v1 rows that survive the grant model, and the ones that do not. */
export interface EligibleMarkRows {
  kept: V1LolRow[];
  skipped: V1LolRow[];
}

interface DisplayIdentityCandidate {
  chatId: number;
  userId: number;
  displayName: string;
  createdAt: number;
}

interface MessageCandidate {
  chatId: number;
  messageId: number;
  authorIds: Set<number>;
  messageDate: number;
}

const DEFAULT_BATCH_SIZE = 1_000;

function quote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function timestamp(date: Date): string {
  return `'${date.toISOString()}'`;
}

/** Latest known display name per (Chat, Member), resolved in memory. */
export function latestDisplayIdentities(
  rows: V1LolRow[],
): DisplayIdentityCandidate[] {
  const candidates = new Map<string, DisplayIdentityCandidate>();

  for (const row of rows) {
    const { displayIdentities: identities } = convertV1Row(row);
    for (const identity of identities) {
      const key = `${String(identity.chatId)}:${String(identity.userId)}`;
      const existing = candidates.get(key);
      if (
        !existing ||
        row.createdAt > existing.createdAt ||
        (row.createdAt === existing.createdAt &&
          identity.displayName.localeCompare(existing.displayName) > 0)
      ) {
        candidates.set(key, { ...identity, createdAt: row.createdAt });
      }
    }
  }

  return [...candidates.values()];
}

/** One author and earliest post time per (Chat, Message), resolved in memory. */
export function messageCandidates(rows: V1LolRow[]): MessageCandidate[] {
  const candidates = new Map<string, MessageCandidate>();

  for (const row of rows) {
    const key = `${String(row.chatId)}:${String(row.toMessageId)}`;
    const existing = candidates.get(key);
    if (existing) {
      existing.authorIds.add(row.toUser.id);
      existing.messageDate = Math.min(
        existing.messageDate,
        Math.floor(row.createdAt / 1_000),
      );
    } else {
      candidates.set(key, {
        chatId: row.chatId,
        messageId: row.toMessageId,
        authorIds: new Set([row.toUser.id]),
        messageDate: Math.floor(row.createdAt / 1_000),
      });
    }
  }

  return [...candidates.values()];
}

/**
 * One v1 row per (Chat, Actor, Message, slot), resolved in memory.
 *
 * v1 let a Member mark the same Message more than once — six `+` on one
 * Message, and in one case a `+` followed by a `-`. The grant model admits one,
 * so the earliest wins, tie-broken by legacy id. The survivors come back in
 * that same order, so the generated file does not depend on scan order.
 */
export function eligibleMarkRows(rows: V1LolRow[]): EligibleMarkRows {
  const winners = new Map<string, V1LolRow>();

  for (const row of rows) {
    const key = markSlotKey(row);
    const existing = winners.get(key);
    if (!existing || isEarlier(row, existing)) {
      winners.set(key, row);
    }
  }

  const keptIds = new Set([...winners.values()].map((row) => row.id));

  return {
    kept: [...winners.values()].toSorted((left, right) =>
      isEarlier(left, right) ? -1 : 1,
    ),
    skipped: rows.filter((row) => !keptIds.has(row.id)),
  };
}

function markSlotKey(row: V1LolRow): string {
  const slot = markSlotForType(convertV1Row(row).mark.type);
  return `${String(row.chatId)}:${String(row.fromUser.id)}:${String(row.toMessageId)}:${slot}`;
}

function isEarlier(row: V1LolRow, than: V1LolRow): boolean {
  if (row.createdAt !== than.createdAt) return row.createdAt < than.createdAt;
  return row.id < than.id;
}

function insertStatements(
  table: string,
  columns: string[],
  tuples: string[],
  conflictTarget: string | null,
  batchSize: number,
): string[] {
  const statements: string[] = [];

  for (let start = 0; start < tuples.length; start += batchSize) {
    const batch = tuples.slice(start, start + batchSize);
    statements.push(
      `INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(", ")})\nVALUES\n  ${batch.join(",\n  ")}\nON CONFLICT${conflictTarget === null ? "" : ` (${conflictTarget})`} DO NOTHING;`,
    );
  }

  return statements;
}

/**
 * Render v1 rows as plain, idempotent INSERT statements.
 *
 * Every conflict is resolved in memory, so the file needs no reads and no
 * transaction: `ON CONFLICT DO NOTHING` makes a re-run — or a resumed run after
 * a kill — land on exactly the same state.
 */
export function buildImportSql(
  rows: V1LolRow[],
  options: BuildImportSqlOptions = {},
): BuildImportSqlResult {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;

  const identityTuples = latestDisplayIdentities(rows).map(
    (candidate) =>
      `(${String(candidate.chatId)}, ${String(candidate.userId)}, ${quote(candidate.displayName)})`,
  );

  const messageTuples: string[] = [];
  const skippedMessages: BuildImportSqlSkipped["messages"] = [];
  for (const candidate of messageCandidates(rows)) {
    const authorId = [...candidate.authorIds].at(0);
    if (candidate.authorIds.size !== 1 || authorId === undefined) {
      skippedMessages.push({
        chatId: candidate.chatId,
        messageId: candidate.messageId,
        authorIds: [...candidate.authorIds],
      });
      continue;
    }

    messageTuples.push(
      `(${String(candidate.chatId)}, ${String(candidate.messageId)}, ${String(authorId)}, false, ${String(candidate.messageDate)})`,
    );
  }

  const eligibleRows = eligibleMarkRows(rows);
  const markTuples = eligibleRows.kept.map((row) => {
    const { mark } = convertV1Row(row);
    return `(${quote(mark.type)}, ${String(mark.chatId)}, ${String(mark.actorId)}, ${String(mark.subjectId)}, ${String(mark.messageId)}, ${timestamp(mark.createdAt)}, ${quote(mark.source)}, ${quote(mark.legacyId)})`;
  });

  const statements = [
    ...insertStatements(
      "display_identities",
      ["chat_id", "user_id", "display_name"],
      identityTuples,
      '"chat_id", "user_id"',
      batchSize,
    ),
    ...insertStatements(
      "message_authors",
      ["chat_id", "message_id", "author_id", "author_is_bot", "message_date"],
      messageTuples,
      '"chat_id", "message_id"',
      batchSize,
    ),
    ...insertStatements(
      "marks",
      [
        "type",
        "chat_id",
        "actor_id",
        "subject_id",
        "message_id",
        "created_at",
        "source",
        "legacy_id",
      ],
      markTuples,
      null,
      batchSize,
    ),
  ];

  const header = [
    "-- Generated by pnpm import:sql. Plain inserts, no transaction:",
    "-- every statement is idempotent, so a killed run resumes by re-running.",
    `-- rows: ${String(rows.length)}, identities: ${String(identityTuples.length)}, messages: ${String(messageTuples.length)}, marks: ${String(markTuples.length)}`,
  ].join("\n");

  const sql = `${header}\n${STATEMENT_SEPARATOR}\n${statements.join(`\n${STATEMENT_SEPARATOR}\n`)}\n`;

  return {
    sql,
    stats: {
      rowsProcessed: rows.length,
      marks: markTuples.length,
      messages: messageTuples.length,
      displayIdentities: identityTuples.length,
      skippedMessages: skippedMessages.length,
      skippedMarks: eligibleRows.skipped.length,
      statements: statements.length,
    },
    skipped: { marks: eligibleRows.skipped, messages: skippedMessages },
  };
}

/** Split a generated file back into executable statements. */
export function splitStatements(sql: string): string[] {
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
