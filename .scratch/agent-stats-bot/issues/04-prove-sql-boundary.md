# 04: Prove the SQL and Chat-isolation boundary

Type: prototype
Status: open
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
