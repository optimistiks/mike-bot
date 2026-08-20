# How does v1 history get into the Mini App?

> Historical record: this resolved ticket is not canonical current-state documentation. Its question, answer, and acceptance criteria may now be false; use the Wayfinder map and specification for current behavior.

Type: grilling
Status: resolved
Blocked by: 03

## Question

Do we one-shot export/import v1 DynamoDB Marks into v2 storage (read-only history), or live-query DynamoDB from Vercel forever? Recommendation: one-shot import into the same store as v2 Marks, tagged as v1, so the Mini App has one query path. Live AWS from Vercel keeps v1 infrastructure on the hot path.

## Answer

One-shot Scan from DynamoDB `lolTable` into a separate Postgres `legacy_marks` table. Import **as-is** — same fields, no transformation. Mini App queries `marks` (v2) and `legacy_marks` (v1) and merges for display. No live DynamoDB reads from Vercel. No `source` column.

## Amended

Superseded by [Legacy read mapping](17-legacy-read-mapping.md) and [v1 import into events](21-v1-import-into-events.md): one-shot Scan converts rows into `events` (not a separate table). Mini App queries `events` only. No live DynamoDB from Vercel. See `scripts/import-v1.ts`.
