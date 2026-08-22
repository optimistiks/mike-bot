/**
 * THROWAWAY PROTOTYPE: proves Chat projection into disposable PGlite.
 * Run: node .scratch/agent-stats-bot/prototypes/04-sql-boundary-proof.mjs
 */

import { PGlite } from "../../../apps/web/node_modules/@electric-sql/pglite/dist/index.js";

const schema = `
  CREATE TABLE events (
    id integer PRIMARY KEY,
    type text NOT NULL,
    chat_id bigint NOT NULL,
    actor_id bigint NOT NULL,
    subject_id bigint NOT NULL,
    message_id bigint NOT NULL,
    created_at timestamptz NOT NULL
  );
  CREATE TABLE message_authors (
    chat_id bigint NOT NULL,
    message_id bigint NOT NULL,
    author_id bigint NOT NULL,
    author_is_bot boolean NOT NULL,
    message_date integer NOT NULL,
    PRIMARY KEY (chat_id, message_id)
  );
  CREATE TABLE display_identities (
    chat_id bigint NOT NULL,
    user_id bigint NOT NULL,
    display_name text NOT NULL,
    PRIMARY KEY (chat_id, user_id)
  );
`;

const projections = [
  [
    "events",
    [
      "id",
      "type",
      "chat_id",
      "actor_id",
      "subject_id",
      "message_id",
      "created_at",
    ],
  ],
  [
    "message_authors",
    [
      "chat_id",
      "message_id",
      "author_id",
      "author_is_bot",
      "message_date",
    ],
  ],
  ["display_identities", ["chat_id", "user_id", "display_name"]],
];

async function projectChat(source, chatId) {
  const snapshot = new PGlite();
  await snapshot.exec(schema);

  for (const [table, columns] of projections) {
    const rows = await source.query(
      `SELECT ${columns.join(", ")} FROM ${table} WHERE chat_id = $1`,
      [chatId],
    );
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");

    for (const row of rows.rows) {
      await snapshot.query(
        `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
        columns.map((column) => row[column]),
      );
    }
  }

  return snapshot;
}

const source = new PGlite();

try {
  await source.exec(`${schema}
    INSERT INTO events VALUES
      (1, 'karma.plus', 100, 12, 11, 1, '2026-07-20T12:05:00Z'),
      (2, 'karma.plus', 100, 12, 11, 2, '2026-07-21T12:05:00Z'),
      (3, 'karma.plus', 100, 11, 12, 3, '2026-07-22T12:05:00Z'),
      (4, 'humor.add', 100, 11, 12, 4, '2026-08-02T12:05:00Z'),
      (5, 'karma.minus', 200, 22, 21, 1, '2026-07-20T12:05:00Z');
    INSERT INTO message_authors VALUES
      (100, 1, 11, false, extract(epoch from timestamptz '2026-07-20T12:00:00Z')),
      (100, 2, 11, false, extract(epoch from timestamptz '2026-07-21T12:00:00Z')),
      (100, 3, 12, false, extract(epoch from timestamptz '2026-07-22T12:00:00Z')),
      (100, 4, 12, false, extract(epoch from timestamptz '2026-08-02T12:00:00Z')),
      (200, 1, 21, false, extract(epoch from timestamptz '2026-07-20T12:00:00Z'));
    INSERT INTO display_identities VALUES
      (100, 11, 'Alice'), (100, 12, 'Bob'),
      (200, 21, 'Mallory'), (200, 22, 'Oscar');
  `);

  const snapshot = await projectChat(source, 100);

  try {
    const visibleChats = await snapshot.query(
      `SELECT DISTINCT chat_id FROM events ORDER BY chat_id`,
    );
    const arbitraryAnalysis = await snapshot.query(`
      SELECT subject.display_name,
        sum(CASE event.type
          WHEN 'karma.plus' THEN 1
          WHEN 'karma.undo.plus' THEN -1
          ELSE 0
        END) AS likes_received
      FROM events AS event
      JOIN message_authors AS message USING (chat_id, message_id)
      JOIN display_identities AS subject
        ON subject.chat_id = event.chat_id
       AND subject.user_id = event.subject_id
      WHERE message.message_date >= extract(epoch from timestamptz '2026-07-16T00:00:00+03:00')
        AND message.message_date < extract(epoch from timestamptz '2026-08-01T00:00:00+03:00')
      GROUP BY subject.user_id, subject.display_name
      ORDER BY subject.display_name
    `);
    const crossChat = await snapshot.query(
      `SELECT * FROM events WHERE chat_id = 200`,
    );

    await snapshot.exec(`DELETE FROM events`);
    const sourceRows = await source.query(
      `SELECT count(*)::integer AS count FROM events WHERE chat_id = 100`,
    );

    console.log(
      JSON.stringify(
        {
          visibleChats: visibleChats.rows.map((row) => Number(row.chat_id)),
          arbitraryAnalysis: arbitraryAnalysis.rows,
          crossChatRows: crossChat.rows,
          sourceRowsAfterSnapshotMutation: sourceRows.rows[0]?.count,
        },
        null,
        2,
      ),
    );
  } finally {
    await snapshot.close();
  }
} finally {
  await source.close();
}
