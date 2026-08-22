/**
 * THROWAWAY PROTOTYPE: proves the selected temp-table privilege boundary.
 *
 * Run from the repository root:
 *   node .scratch/agent-stats-bot/prototypes/04-sql-boundary-proof.mjs
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { PGlite } from "../../../apps/web/node_modules/@electric-sql/pglite/dist/index.js";

const MAX_ROWS = 3;
const dataDir = await mkdtemp(path.join(tmpdir(), "mike-bot-sql-proof-"));
let db = new PGlite(dataDir);

try {
  await db.exec(`
    CREATE ROLE neon_owner LOGIN CREATEROLE;
    CREATE ROLE stats_agent
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
      NOINHERIT NOREPLICATION NOBYPASSRLS;
    GRANT stats_agent TO neon_owner;

    CREATE SCHEMA private;
    CREATE SCHEMA stats AUTHORIZATION stats_agent;
    REVOKE ALL ON SCHEMA private, stats FROM PUBLIC;
    GRANT USAGE ON SCHEMA private, stats TO neon_owner;

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

    GRANT SELECT ON
      private.events,
      private.message_authors,
      private.display_identities
    TO neon_owner;

    SET ROLE stats_agent;
    CREATE FUNCTION stats.execute_scoped_sql(
      generated_sql text,
      max_rows integer
    )
    RETURNS SETOF jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = pg_catalog, pg_temp
    AS $function$
    BEGIN
      IF max_rows < 1 OR max_rows > 1000 THEN
        RAISE EXCEPTION 'invalid row limit';
      END IF;

      RETURN QUERY EXECUTE format(
        'SELECT to_jsonb(agent_result) FROM (%s) AS agent_result LIMIT %s',
        generated_sql,
        max_rows
      );
    END;
    $function$;
    REVOKE ALL
      ON FUNCTION stats.execute_scoped_sql(text, integer)
      FROM PUBLIC;
    GRANT EXECUTE
      ON FUNCTION stats.execute_scoped_sql(text, integer)
      TO neon_owner;
    RESET ROLE;
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
      await tx.exec("SET LOCAL statement_timeout = '100ms'");
      await tx.query(
        `CREATE TEMP TABLE scoring_events
         ON COMMIT DROP
         AS
           SELECT
             e.type AS event_type,
             e.actor_id,
             actor.display_name AS actor_name,
             e.subject_id,
             subject.display_name AS subject_name,
             to_timestamp(authors.message_date) AS message_at,
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
           FROM private.events AS e
           JOIN private.message_authors AS authors
             ON authors.chat_id = e.chat_id
             AND authors.message_id = e.message_id
           LEFT JOIN private.display_identities AS actor
             ON actor.chat_id = e.chat_id
             AND actor.user_id = e.actor_id
           LEFT JOIN private.display_identities AS subject
             ON subject.chat_id = e.chat_id
             AND subject.user_id = e.subject_id
           WHERE e.chat_id = $1`,
        [trustedChatId],
      );
      await tx.exec("GRANT SELECT ON scoring_events TO stats_agent");

      const result = await tx.query(
        `SELECT value
         FROM stats.execute_scoped_sql($1, $2) AS scoped(value)`,
        [generatedSql, MAX_ROWS + 1],
      );

      return {
        rows: result.rows.slice(0, MAX_ROWS).map(({ value }) => value),
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
           FROM scoring_events
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
           FROM scoring_events
           GROUP BY season
           ORDER BY season`,
        ),
    ],
    [
      "cross-Chat through scoped data",
      () =>
        queryStats(
          100,
          "SELECT * FROM scoring_events WHERE subject_name = 'Mallory'",
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
      "change an irrelevant custom setting",
      () =>
        queryStats(
          100,
          `WITH changed AS (
             SELECT set_config('app.chat_id', '200', true)
           )
           SELECT count(*) AS rows
           FROM scoring_events
           CROSS JOIN changed
           WHERE subject_name = 'Mallory'`,
        ),
    ],
    [
      "reset role through set_config",
      () =>
        queryStats(
          100,
          "SELECT set_config('role', 'none', true) AS escaped_role",
        ),
    ],
    ["SET command", () => queryStats(100, "SET ROLE neon_owner")],
    ["RESET ROLE", () => queryStats(100, "RESET ROLE")],
    [
      "multiple statements",
      () => queryStats(100, "SELECT * FROM scoring_events; RESET ROLE"),
    ],
    [
      "mutate base data",
      () => queryStats(100, "DELETE FROM private.events RETURNING *"),
    ],
    [
      "mutate scoped data",
      () => queryStats(100, "DELETE FROM scoring_events RETURNING *"),
    ],
    [
      "row cap",
      () =>
        queryStats(
          100,
          "SELECT * FROM scoring_events ORDER BY action_at",
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

  const cleanup = await db.query(
    "SELECT to_regclass('pg_temp.scoring_events') IS NULL AS dropped",
  );
  console.log(
    JSON.stringify({
      name: "temp table cleanup",
      outcome: cleanup.rows[0]?.dropped ? "allowed" : "blocked",
      rows: cleanup.rows,
    }),
  );
} finally {
  if (!db.closed) {
    await db.close();
  }
  await rm(dataDir, { recursive: true, force: true });
}
