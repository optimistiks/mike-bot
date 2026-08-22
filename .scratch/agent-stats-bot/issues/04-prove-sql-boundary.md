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

The deployed application will receive separate human-supplied operational and agent database URLs. The
agent tool must construct its connection exclusively from the agent URL; ingestion, imports, and migrations
must never use that connection.

Do not replace generated SQL with a fixed catalogue of analytics tools; generated SQL is a settled product
decision.

## Done when

- A minimal executable proof demonstrates ordinary cross-category and cross-season questions.
- Attempts to mutate data or read another Chat fail at the tool/database boundary, not merely by prompt.
- The proof names the exact capabilities required from the operational and agent connections without
  depending on whether they belong to a new or existing Neon project.
- The answer recommends one mechanism appropriate to this toy and records what complexity it adds.

## Answer

### Decision

Pre-scope the invoking Chat into one transaction-local temporary table named `scoring_events`, then execute
generated SQL through one `SECURITY DEFINER` function owned by the limited `stats_agent` role. The function
turns PostgreSQL's normally privilege-raising feature into a privilege drop: its owner has no access to the
persistent application tables and receives `SELECT` only on the already-scoped temporary table.

This replaces the rejected RLS/custom-setting design. Chat identity never becomes mutable session state, and
generated SQL never receives `chat_id`. The boundary adds one existing `NOLOGIN` role, one small executor
function, one temporary table per tool call, and one direct database connection pinned for the transaction.

### Why the function is required

Creating the temporary table as the default Neon role and then using plain `SET ROLE stats_agent` is unsafe.
Even inside a nested `SELECT`, generated SQL can call `set_config('role', 'none', true)` and restore the
session's `neondb_owner` role. Revoking `set_config` is not available in Neon because `cloud_admin` owns the
function and its `PUBLIC` grant.

Generated SQL instead runs inside `stats.execute_scoped_sql(text, integer)`, whose owner is `stats_agent`.
PostgreSQL treats execution inside a security-definer function as security-restricted: changing `role` or
`session_authorization` fails. The executor also nests generated SQL inside one outer `SELECT`, applies the
row cap, returns rows as JSON, and fixes its search path to `pg_catalog, pg_temp`.

The function's default `PUBLIC` execution grant is removed, and the existing default Neon role receives the
explicit caller grant. It is not a privileged gateway: because `stats_agent` owns it, any generated query
that names `public.events` or another persistent application table still fails for lack of privileges.

### Per-query boundary

Every SQL tool call independently performs this sequence on one checked-out direct connection:

1. Begin a normal transaction and set a 2-second server-side `statement_timeout`.
2. Run one fixed, parameterized `CREATE TEMP TABLE scoring_events ON COMMIT DROP AS ... WHERE e.chat_id =
   $1` statement as the existing default Neon role. `$1` is closed over from the Telegram update or direct
   Stats harness and is absent from model-controlled tool arguments.
3. Grant `stats_agent` `SELECT` on that temporary table. Do not grant `INSERT`, `UPDATE`, `DELETE`, or any
   privilege on the persistent source tables.
4. Call `stats.execute_scoped_sql(generatedSql, 201)`. The model controls only `generatedSql`; trusted code
   supplies the row limit.
5. Return the first 200 JSON rows plus a `truncated` flag and commit. Any error rolls back. `ON COMMIT DROP`
   also removes the table before a pooled client can reuse the session.

The transaction cannot be declared read-only: PostgreSQL rejects `CREATE TABLE AS` in a read-only
transaction. Read-only enforcement therefore comes from `stats_agent` privileges and the executor's nested
query, not from the transaction flag. The trusted staging statement is fixed application code.

The client should additionally use a 2.5-second deadline so a lost or delayed server cancellation cannot
hold the agent loop indefinitely. A complicated Stats question may invoke the tool several times; every call
rebuilds the scoped table in a fresh transaction.

### Model-visible schema

Teach the model exactly one temporary relation, `scoring_events`:

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

Do not include `chat_id`, `message_id`, `legacy_id`, or a provenance-specific Season branch. The fixed staging
query joins `events`, `message_authors`, and both current Display identities before the privilege drop.

### Role and connection capabilities

- **Operational database URL:** the existing default Neon role on the normal application connection;
  ingestion writes, imports, migrations, and role/function administration use it.
- **Agent database URL:** the existing default Neon role on a direct, unpooled connection to the primary
  compute. Only the agent SQL module imports it. It stages the trusted temporary table and calls the limited
  executor; generated SQL never runs with its privileges.
- **`stats_agent`:** remains `NOLOGIN`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOINHERIT`,
  `NOREPLICATION`, and `NOBYPASSRLS`. It owns the executor function and receives `SELECT` only on each
  transaction's `scoring_events` table. It receives no persistent table grants.

A true Neon read-replica URL is incompatible with this design because the staging `CREATE TEMP TABLE AS`
requires a read-write transaction. The implementation therefore uses a separately named direct primary URL
for agent session pinning rather than a read replica. This is acceptable for the toy because the generated
query itself remains privilege-read-only and timeout-limited.

The role already created manually on the live `main` branch has the required flags. The corrected
[role bootstrap](../prototypes/04-create-agent-role.sql) no longer attempts to revoke `set_config`. The
[executor DDL](../prototypes/04-create-agent-executor.sql) is prototype migration input; it was tested inside
a rolled-back Neon transaction and has not been installed on the live database.

### Proof

The [executable PGlite proof](../prototypes/04-sql-boundary-proof.mjs) demonstrates cross-category and
cross-Season analytics, empty cross-Chat results through scoped data, denied reads of persistent tables,
harmless custom-setting changes, blocked role reset through `set_config`, blocked commands and mutations,
the row cap, active timeout/role, and `ON COMMIT DROP` cleanup. The
[interactive walkthrough](../prototypes/04-sql-boundary-demo.html) presents the same cases. Run the proof
from the repository root with:

```bash
node .scratch/agent-stats-bot/prototypes/04-sql-boundary-proof.mjs
```

Live Neon CLI checks against `main` additionally proved:

- `stats_agent` has no `SELECT` privilege on any application table and no executable application-defined
  security-definer function currently exists.
- A normal transaction can create the scoped table, grant only `SELECT`, and drop it on commit; the same
  `CREATE TABLE AS` fails in a read-only transaction.
- Plain `SET ROLE stats_agent` is escapable through `set_config('role', 'none', true)`.
- The `stats_agent`-owned executor successfully reads the granted temporary table, rejects the role-reset
  call as a security-restricted operation, and rejects `public.events` for lack of privilege.

All live proof objects and transactions were rolled back or dropped on commit. No persistent database change
was made during verification.

Rejected alternatives:

- RLS with `app.chat_id` is mutable because every role retains `PUBLIC` execution of `set_config` on Neon.
- Temp-table staging followed by plain `SET ROLE` is escapable through the `role` setting.
- A `LOGIN` limited role plus copying rows through application memory is safe but adds another credential,
  connection, and a database-to-app-to-database round trip.
- A PostgreSQL-aware SQL parser is larger and more security-sensitive than the limited executor.
- One role or view per Chat creates open-ended provisioning and cleanup.

## Comments

- Human review replaced the RLS/custom-GUC design with a privilege-scoped temporary-table design.
- Neon CLI verification surfaced the `set_config('role', 'none', true)` escape and read-replica incompatibility;
  the final executor design closes both gaps while retaining one existing default role and one limited role.
