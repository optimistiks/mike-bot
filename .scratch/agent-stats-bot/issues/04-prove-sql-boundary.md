# 04: Prove the SQL and Chat-isolation boundary

Type: prototype
Status: resolved
Blocked by: 01, 02, 09

## Question

What is the smallest database-tool design that lets the model generate arbitrary analytical SQL while
guaranteeing that it can only read scoring data belonging to the invoking Chat?

Assume imported message metadata has been normalized as decided in
[Normalize imported message metadata](09-normalize-imported-message-authors.md). The schema exposed to the
agent must use `message_authors.message_date` for every Event and must not teach the model a `legacy_id`
branch for Season attribution.

The proof must cover read-only enforcement, injection of trusted Chat context outside model-controlled tool
arguments, query time/row limits, and the schema surface visible to the model. Compare the minimum viable
options—such as a restricted database role/read replica plus Chat-scoped views or row-level security—and
exercise the chosen boundary with both valid and adversarial queries.

The deployed application will receive separate human-supplied operational and read-replica database URLs.
The agent tool must construct its connection exclusively from the read-replica URL; ingestion, imports, and
migrations must never use that connection.

Do not replace generated SQL with a fixed catalogue of analytics tools; generated SQL is a settled product
decision.

## Done when

- A minimal executable proof demonstrates ordinary cross-category and cross-season questions.
- Attempts to mutate data or read another Chat fail at the tool/database boundary, not merely by prompt.
- The proof names the exact capabilities required from the operational and read-replica connections without
  depending on whether they belong to a new or existing Neon project.
- The answer recommends one mechanism appropriate to this toy and records what complexity it adds.

## Answer

### Decision

Use PostgreSQL Row-Level Security with the existing default Neon role as trusted transaction setup and one
new `NOLOGIN`, `NOBYPASSRLS` role named `stats_agent` for generated SQL. The application sets the trusted
Telegram Chat before dropping to `stats_agent`; the model controls only the SQL nested inside a single
outer `SELECT`.

This is smaller than either a PostgreSQL-aware application validator or a capability-token function. It
adds one role, three RLS policies, one read view, a database-function privilege change, and a small query
wrapper. It supports any number of Chats without provisioning per-Chat database objects.

### Per-query boundary

Every agent SQL tool call independently performs this sequence on a connection constructed exclusively from
the human-supplied read-replica URL:

1. Begin a read-only transaction as the existing default Neon role.
2. Set a 2-second server-side `statement_timeout`.
3. Call `set_config('app.chat_id', trustedChatId, true)`, where `trustedChatId` is closed over from the
   Telegram update or direct Stats harness and is absent from model-controlled tool arguments.
4. Execute `SET LOCAL ROLE stats_agent`.
5. Run the generated SQL as a nested query and fetch at most 201 rows:

   ```sql
   SELECT *
   FROM (<generated SELECT>) AS agent_result
   LIMIT 201
   ```

6. Return the first 200 rows plus a `truncated` flag; always end the transaction before returning tool output.

The client should additionally use a 2.5-second query deadline so a lost or delayed server cancellation does
not hold the agent loop indefinitely. A complicated Stats question may invoke this tool several times; every
call receives the same trusted Chat through a fresh transaction and boundary.

The outer query makes `SET`, `RESET ROLE`, mutation commands, and multiple statements invalid syntax. The
`stats_agent` role cannot execute `pg_catalog.set_config(text, text, boolean)`, closing the remaining path by
which a single `SELECT` could change `app.chat_id`.

### RLS and model-visible schema

Enable and force RLS on `events`, `message_authors`, and `display_identities`. Give `stats_agent` only
`SELECT` privileges, and apply a `FOR SELECT TO stats_agent` policy to each table:

```sql
USING (
  chat_id = nullif(current_setting('app.chat_id', true), '')::bigint
)
```

A missing context therefore exposes no rows; malformed trusted context fails the query. `stats_agent` must
not own the protected tables.

Teach the model one `security_barrier`, `security_invoker` view named `stats.scoring_events`. It joins Events
to message authors and current Display identities and exposes:

| Column | Meaning |
| --- | --- |
| `event_type` | One of the six Event types. |
| `actor_id`, `actor_name` | Member who applied or removed the Mark. |
| `subject_id`, `subject_name` | Member whose message received the Mark. |
| `message_at` | `to_timestamp(message_authors.message_date)`; the sole Season timestamp for every Event. |
| `action_at` | Telegram action timestamp from `events.created_at`. |
| `karma_received_delta` | Signed contribution to Subject Karma. |
| `humor_received_delta` | Signed contribution to Subject Humor. |
| `karma_plus_given_delta` | Signed contribution to Actor Karma plus given. |
| `karma_minus_given_delta` | Signed contribution to Actor Karma minus given. |
| `humor_given_delta` | Signed contribution to Actor Humor Marks given. |

Do not expose `chat_id`, `message_id`, `legacy_id`, or a provenance-specific Season branch in the model
schema. Direct queries against the underlying tables remain Chat-safe because RLS applies there too.

### Role and connection capabilities

- **Existing default Neon role, operational URL:** ingestion writes, imports, migrations, RLS/view creation,
  and role/grant administration. The bot's ingestion, import, and migration modules use only this operational
  connection.
- **Existing default Neon role, read-replica URL:** trusted transaction setup, `set_config`, and
  `SET LOCAL ROLE stats_agent`. The agent SQL module uses only this URL and never imports the operational
  connection constructor.
- **`stats_agent`:** is `NOLOGIN`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOREPLICATION`, and
  `NOBYPASSRLS`. It
  receives only the schema usage and `SELECT` grants needed by the scoring view and its RLS-protected source
  tables. Membership is one-way: the default role may become `stats_agent`; `stats_agent` cannot become the
  default role.

The default execute grant on `pg_catalog.set_config(text, text, boolean)` must be revoked from `PUBLIC` in
this database and granted back to the existing default Neon role. The current repository contains no use of
`set_config`; any future trusted role that genuinely needs it must be granted explicitly.

The human runs [the role bootstrap SQL](../prototypes/04-create-agent-role.sql) once against the primary
compute as the existing default Neon role. The later infrastructure handoff must include the role command,
read-replica URL construction, privilege checks, a live cross-Chat RLS check, and a Neon timeout smoke test.
No new password or connection string is required for `stats_agent` because it is `NOLOGIN`.

### Proof and alternatives

The [executable PGlite proof](../prototypes/04-sql-boundary-proof.mjs) demonstrates cross-category and
cross-Season analytics, direct cross-Chat attempts through both the view and source tables, `set_config`,
`SET`, `RESET ROLE`, multi-statement and mutation attempts, role downgrade, and result truncation. The
[interactive walkthrough](../prototypes/04-sql-boundary-demo.html) presents the same cases. Run the proof
from the repository root with:

```bash
node .scratch/agent-stats-bot/prototypes/04-sql-boundary-proof.mjs
```

PGlite accepts and reports `statement_timeout` but does not interrupt `pg_sleep`, so local automated tests
should verify timeout configuration through the database adapter rather than wait on a real slow query. The
human Neon smoke test verifies actual cancellation after infrastructure exists.

Rejected alternatives:

- A SQL parser plus trusted CTE moves the hard boundary into a complex, security-sensitive AST validator.
- Plain RLS with a mutable custom setting lets generated `SELECT` call `set_config` and change Chats.
- One role or view per Chat creates open-ended provisioning and cleanup.
- A signed capability function avoids the global `set_config` grant change but adds two security-definer
  functions and secret management without improving this toy's user-visible behavior.

## Comments

- Human review selected the one-new-role RLS design after rejecting the capability-function prototype and a
  PostgreSQL AST validator as unnecessary complexity.
