# How does v1 history get into the Mini App?

Type: grilling
Status: open
Blocked by: 03

## Question

Do we one-shot export/import v1 DynamoDB Marks into v2 storage (read-only history), or live-query DynamoDB from Vercel forever? Recommendation: one-shot import into the same store as v2 Marks, tagged as v1, so the Mini App has one query path. Live AWS from Vercel keeps v1 infrastructure on the hot path.
