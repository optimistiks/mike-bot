# 04: Prove the SQL and Chat-isolation boundary

Type: prototype
Status: resolved
Blocked by: 01, 02, 09

## Question

What is the smallest database-tool design that lets the model generate arbitrary analytical SQL while
guaranteeing that it can only inspect scoring data belonging to the invoking Chat?

Assume imported message metadata has been normalized as decided in
[Normalize imported message metadata](09-normalize-imported-message-authors.md). The model must use
`message_authors.message_date` for every Event and must not learn a `legacy_id` branch for Season
attribution.

Do not replace generated SQL with a fixed catalogue of analytics tools. This is a toy: prefer a disposable
data boundary over database roles, RLS, SQL validation, or production hardening.

## Done when

- A minimal executable proof copies raw rows for one trusted Chat into in-memory PGlite.
- The model can run arbitrary PostgreSQL queries across the copied tables and make several queries per Stats
  question.
- Another Chat's rows are absent regardless of the generated SQL.
- Mutating the disposable copy cannot mutate the source database.
- The answer names the data copied, the required connection, and the deliberate limits of the toy.

## Answer

### Decision

For every Stats question, trusted application code copies the invoking Chat's raw scoring rows from Neon into
a fresh in-memory PGlite database. The model receives an unrestricted `query(sql)` tool connected only to
that PGlite instance. The instance is closed after the one-shot agent run.

Isolation comes from absence: another Chat's rows never enter the database available to generated SQL. The
model may inspect PostgreSQL catalogues, issue several queries, or mutate its copy; none of those actions can
reach Neon or another Chat.

This supersedes the earlier limited-role, temporary-table, and executor design.

### Projection

Mike obtains the trusted `chatId` from the Telegram update or direct Stats harness. It is not a tool argument.
Using the ordinary operational database connection, Mike runs one fixed parameterized `SELECT ... WHERE
chat_id = $1` for each of these tables:

- `events`: `id`, `type`, `chat_id`, `actor_id`, `subject_id`, `message_id`, `created_at`
- `message_authors`: `chat_id`, `message_id`, `author_id`, `author_is_bot`, `message_date`
- `display_identities`: `chat_id`, `user_id`, `display_name`

Mike creates the same three small tables in a new `PGlite()` instance and inserts those rows. The projection
does not join tables, calculate score deltas, or encode Event semantics. Scoring rules remain business logic
in the agent instructions; generated SQL applies them for the question being answered.

The complete Chat history is copied for this toy. Range preselection, caching, and incremental snapshots are
not part of the design.

### Agent flow

1. Resolve the invoking Chat ID outside model-controlled input.
2. Read the three raw Chat-scoped row sets from the ordinary Neon connection.
3. Create one in-memory PGlite instance and load the rows.
4. Give the model the three-table schema, scoring rules, and a direct `query(sql)` tool.
5. Let the model issue as many analytical queries as the later agent contract permits.
6. Close PGlite after the answer or error.

There is no agent database URL, database migration, `stats_agent` role, RLS policy, scoped view, SQL parser,
or executor function. The manually created `stats_agent` role is unused and may remain harmlessly in Neon;
the executor function was never installed.

### Deliberate toy limits

This decision adds only PGlite startup and copying the Chat's rows on every Stats invocation. It deliberately
does not add read-only enforcement, SQL validation, query timeouts, result-size caps, extension controls, or
filesystem/network sandboxing. Generated SQL can damage or hang its disposable PGlite instance. That may
make one Stats answer fail, but it cannot expose another Chat or mutate Neon because neither the other rows
nor the Neon connection exist inside that query tool.

### Proof

The [executable PGlite proof](../prototypes/04-sql-boundary-proof.mjs) creates a source database containing
two Chats, projects Chat 100's three raw tables into a second in-memory PGlite instance, runs an arbitrary
cross-table aggregation, proves that `WHERE chat_id = 200` returns no rows, deletes the copied Events, and
then proves that the source Events remain intact. Run it from the repository root:

```bash
node .scratch/agent-stats-bot/prototypes/04-sql-boundary-proof.mjs
```

The [interactive walkthrough](../prototypes/04-sql-boundary-demo.html) presents the same boundary as a
double-clickable logic demo.

## Comments

- The first resolution used a limited Neon role, transaction-local table, and security-definer executor.
- Human review rejected that complexity and chose unrestricted SQL over raw Chat-scoped data in disposable
  in-memory PGlite.
