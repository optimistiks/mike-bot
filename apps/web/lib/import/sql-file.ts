import { convertV1Row, type V1LolRow } from "./v1-row";

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
  events: number;
  messages: number;
  displayIdentities: number;
  skippedMessages: number;
  statements: number;
}

export interface BuildImportSqlResult {
  sql: string;
  stats: BuildImportSqlStats;
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
  let skippedMessages = 0;
  for (const candidate of messageCandidates(rows)) {
    const authorId = [...candidate.authorIds].at(0);
    if (candidate.authorIds.size !== 1 || authorId === undefined) {
      console.warn("Skipping v1 Message with conflicting source authors", {
        chatId: candidate.chatId,
        messageId: candidate.messageId,
        authorIds: [...candidate.authorIds],
      });
      skippedMessages += 1;
      continue;
    }

    messageTuples.push(
      `(${String(candidate.chatId)}, ${String(candidate.messageId)}, ${String(authorId)}, false, ${String(candidate.messageDate)})`,
    );
  }

  const eventTuples = rows.map((row) => {
    const { event } = convertV1Row(row);
    return `(${quote(event.type)}, ${String(event.chatId)}, ${String(event.actorId)}, ${String(event.subjectId)}, ${String(event.messageId)}, ${timestamp(event.createdAt)}, false, NULL, ${quote(event.legacyId)})`;
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
      "events",
      [
        "type",
        "chat_id",
        "actor_id",
        "subject_id",
        "message_id",
        "created_at",
        "reversible",
        "reverses_event_id",
        "legacy_id",
      ],
      eventTuples,
      '"legacy_id"',
      batchSize,
    ),
  ];

  const header = [
    "-- Generated by pnpm import:sql. Plain inserts, no transaction:",
    "-- every statement is idempotent, so a killed run resumes by re-running.",
    `-- rows: ${String(rows.length)}, identities: ${String(identityTuples.length)}, messages: ${String(messageTuples.length)}, events: ${String(eventTuples.length)}`,
  ].join("\n");

  const sql = `${header}\n${STATEMENT_SEPARATOR}\n${statements.join(`\n${STATEMENT_SEPARATOR}\n`)}\n`;

  return {
    sql,
    stats: {
      rowsProcessed: rows.length,
      events: eventTuples.length,
      messages: messageTuples.length,
      displayIdentities: identityTuples.length,
      skippedMessages,
      statements: statements.length,
    },
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
