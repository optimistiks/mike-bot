# How does v1 history get into the Mini App?

Type: grilling
Status: resolved
Blocked by: 03

## Question

Do we one-shot export/import v1 DynamoDB Marks into v2 storage (read-only history), or live-query DynamoDB from Vercel forever? Recommendation: one-shot import into the same store as v2 Marks, tagged as v1, so the Mini App has one query path. Live AWS from Vercel keeps v1 infrastructure on the hot path.

## Answer

One-shot Scan from DynamoDB `lolTable` into a separate Postgres `legacy_marks` table. Import **as-is** — same fields, no transformation. Mini App queries `marks` (v2) and `legacy_marks` (v1) and merges for display. No live DynamoDB reads from Vercel. No `source` column.
