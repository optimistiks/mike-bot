/**
 * THROWAWAY PROTOTYPE: proves the selected RLS boundary with PGlite.
 *
 * Run from the repository root:
 *   node .scratch/agent-stats-bot/prototypes/04-sql-boundary-proof.mjs
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { PGlite } from "../../../apps/web/node_modules/@electric-sql/pglite/dist/index.js";

const MAX_ROWS = 3;
const dataDir = await mkdtemp(path.join(tmpdir(), "mike-bot-rls-proof-"));
let db = new PGlite(dataDir);

try {
  await db.exec(`
    -- neon_owner stands in for the existing default Neon role. It deliberately
    -- bypasses RLS so the proof demonstrates that SET ROLE drops that power.
    CREATE ROLE neon_owner LOGIN CREATEROLE BYPASSRLS;
    CREATE ROLE stats_agent
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
      NOINHERIT NOREPLICATION NOBYPASSRLS;
    GRANT stats_agent TO neon_owner;

    CREATE SCHEMA private;
    CREATE SCHEMA stats;
    REVOKE ALL ON SCHEMA private, stats FROM PUBLIC;

    CREATE TABLE private.events (
      id integer PRIMARY KEY,
      type text NOT NULL,
      chat_id bigint NOT NULL,
      actor_id bigint NOT NULL,
      subject_id bigint NOT NULL,
      message_id bigint NOT NULL,
      created_at timestamptz NOT NULL
    );
    CREATE TABLE private.message_authors (
      chat_id bigint NOT NULL,
      message_id bigint NOT NULL,
      author_id bigint NOT NULL,
      message_date integer NOT NULL,
      PRIMARY KEY (chat_id, message_id)
    );
    CREATE TABLE private.display_identities (
      chat_id bigint NOT NULL,
      user_id bigint NOT NULL,
      display_name text NOT NULL,
      PRIMARY KEY (chat_id, user_id)
    );

    INSERT INTO private.message_authors VALUES
      (100, 1, 11, 1785542400),
      (100, 2, 12, 1788220800),
      (100, 3, 11, 1788307200),
      (100, 4, 12, 1788393600),
      (100, 5, 11, 1788480000),
      (200, 1, 21, 1785542400);
    INSERT INTO private.events VALUES
      (1, 'karma.plus', 100, 12, 11, 1, '2026-08-01T00:01:00Z'),
      (2, 'humor.add', 100, 11, 12, 2, '2026-09-01T00:01:00Z'),
      (3, 'karma.minus', 100, 11, 12, 3, '2026-09-02T00:01:00Z'),
      (4, 'karma.undo.minus', 100, 11, 12, 4, '2026-09-03T00:01:00Z'),
      (5, 'karma.plus', 100, 12, 11, 5, '2026-09-04T00:01:00Z'),
      (6, 'karma.minus', 200, 22, 21, 1, '2026-08-01T00:01:00Z');
    INSERT INTO private.display_identities VALUES
      (100, 11, 'Alice'),
      (100, 12, 'Bob'),
      (200, 21, 'Mallory'),
      (200, 22, 'Oscar');

    ALTER TABLE private.events ENABLE ROW LEVEL SECURITY;
    ALTER TABLE private.events FORCE ROW LEVEL SECURITY;
    CREATE POLICY stats_agent_events_chat ON private.events
      FOR SELECT TO stats_agent
      USING (
        chat_id = nullif(current_setting('app.chat_id', true), '')::bigint
      );

    ALTER TABLE private.message_authors ENABLE ROW LEVEL SECURITY;
    ALTER TABLE private.message_authors FORCE ROW LEVEL SECURITY;
    CREATE POLICY stats_agent_message_authors_chat ON private.message_authors
      FOR SELECT TO stats_agent
      USING (
        chat_id = nullif(current_setting('app.chat_id', true), '')::bigint
      );

    ALTER TABLE private.display_identities ENABLE ROW LEVEL SECURITY;
    ALTER TABLE private.display_identities FORCE ROW LEVEL SECURITY;
    CREATE POLICY stats_agent_display_identities_chat
      ON private.display_identities
      FOR SELECT TO stats_agent
      USING (
        chat_id = nullif(current_setting('app.chat_id', true), '')::bigint
      );

    CREATE VIEW stats.scoring_events
    WITH (security_barrier = true, security_invoker = true)
    AS
      SELECT
        e.type AS event_type,
        e.actor_id,
        actor.display_name AS actor_name,
        e.subject_id,
        subject.display_name AS subject_name,
        to_timestamp(ma.message_date) AS message_at,
        e.created_at AS action_at,
        CASE e.type
          WHEN 'karma.plus' THEN 1
          WHEN 'karma.undo.plus' THEN -1
          WHEN 'karma.minus' THEN -1
          WHEN 'karma.undo.minus' THEN 1
          ELSE 0
        END AS karma_received_delta,
        CASE e.type
          WHEN 'humor.add' THEN 1
          WHEN 'humor.undo.add' THEN -1
          ELSE 0
        END AS humor_received_delta,
        CASE e.type
          WHEN 'karma.plus' THEN 1
          WHEN 'karma.undo.plus' THEN -1
          ELSE 0
        END AS karma_plus_given_delta,
        CASE e.type
          WHEN 'karma.minus' THEN 1
          WHEN 'karma.undo.minus' THEN -1
          ELSE 0
        END AS karma_minus_given_delta,
        CASE e.type
          WHEN 'humor.add' THEN 1
          WHEN 'humor.undo.add' THEN -1
          ELSE 0
        END AS humor_given_delta
      FROM private.events e
      JOIN private.message_authors ma
        ON ma.chat_id = e.chat_id AND ma.message_id = e.message_id
      LEFT JOIN private.display_identities actor
        ON actor.chat_id = e.chat_id AND actor.user_id = e.actor_id
      LEFT JOIN private.display_identities subject
        ON subject.chat_id = e.chat_id AND subject.user_id = e.subject_id;

    GRANT USAGE ON SCHEMA private, stats TO stats_agent;
    GRANT SELECT ON
      private.events,
      private.message_authors,
      private.display_identities,
      stats.scoring_events
    TO stats_agent;

    -- set_config is executable by PUBLIC by default. Only trusted setup code
    -- keeps it; generated SQL runs after SET ROLE stats_agent.
    REVOKE EXECUTE
      ON FUNCTION pg_catalog.set_config(text, text, boolean)
      FROM PUBLIC;
    GRANT EXECUTE
      ON FUNCTION pg_catalog.set_config(text, text, boolean)
      TO neon_owner;
  `);

  await db.close();
  db = new PGlite({
    dataDir,
    username: "neon_owner",
    database: "template1",
  });
  await db.waitReady;

  async function queryStats(trustedChatId, generatedSql) {
    return db.transaction(async (tx) => {
      await tx.exec("SET TRANSACTION READ ONLY");
      await tx.query("SELECT set_config('app.chat_id', $1, true)", [
        trustedChatId,
      ]);
      await tx.exec(
        "SET LOCAL statement_timeout = '100ms'; SET LOCAL ROLE stats_agent;",
      );

      const result = await tx.query(
        `SELECT *
         FROM (${generatedSql}) AS agent_result
         LIMIT ${MAX_ROWS + 1}`,
      );

      return {
        rows: result.rows.slice(0, MAX_ROWS),
        truncated: result.rows.length > MAX_ROWS,
      };
    });
  }

  const cases = [
    [
      "cross-category analytics",
      () =>
        queryStats(
          100,
          `SELECT
             subject_name,
             sum(karma_received_delta) AS karma,
             sum(humor_received_delta) AS humor
           FROM stats.scoring_events
           GROUP BY subject_id, subject_name
           ORDER BY subject_name`,
        ),
    ],
    [
      "cross-season analytics",
      () =>
        queryStats(
          100,
          `SELECT
             to_char(
               message_at AT TIME ZONE 'Europe/Moscow',
               'YYYY-MM'
             ) AS season,
             sum(karma_received_delta) AS karma,
             sum(humor_received_delta) AS humor
           FROM stats.scoring_events
           GROUP BY season
           ORDER BY season`,
        ),
    ],
    [
      "cross-Chat through scoring view",
      () =>
        queryStats(
          100,
          "SELECT * FROM stats.scoring_events WHERE subject_name = 'Mallory'",
        ),
    ],
    [
      "cross-Chat through base Event table",
      () =>
        queryStats(
          100,
          "SELECT * FROM private.events WHERE chat_id = 200",
        ),
    ],
    [
      "cross-Chat through Display identities",
      () =>
        queryStats(
          100,
          "SELECT * FROM private.display_identities WHERE chat_id = 200",
        ),
    ],
    [
      "change trusted Chat with set_config",
      () =>
        queryStats(
          100,
          "SELECT set_config('app.chat_id', '200', true)",
        ),
    ],
    ["SET command", () => queryStats(100, "SET app.chat_id = '200'")],
    ["RESET ROLE", () => queryStats(100, "RESET ROLE")],
    [
      "multiple statements",
      () =>
        queryStats(
          100,
          "SELECT * FROM stats.scoring_events; RESET ROLE",
        ),
    ],
    [
      "mutate",
      () => queryStats(100, "DELETE FROM private.events RETURNING *"),
    ],
    [
      "row cap",
      () =>
        queryStats(
          100,
          "SELECT * FROM stats.scoring_events ORDER BY action_at",
        ),
    ],
    [
      "active role and timeout",
      () =>
        queryStats(
          100,
          `SELECT
             current_user AS role,
             current_setting('statement_timeout') AS timeout`,
        ),
    ],
  ];

  for (const [name, run] of cases) {
    try {
      const result = await run();
      console.log(JSON.stringify({ name, outcome: "allowed", ...result }));
    } catch (error) {
      console.log(
        JSON.stringify({ name, outcome: "blocked", error: error.message }),
      );
    }
  }
} finally {
  if (!db.closed) {
    await db.close();
  }
  await rm(dataDir, { recursive: true, force: true });
}
