# How do we read v1 DynamoDB Marks?

> Historical record: this resolved ticket is not canonical current-state documentation. Its question, answer, and acceptance criteria may now be false; use the Wayfinder map and specification for current behavior.

Type: research
Status: resolved

## Question

v1 stores Marks in DynamoDB table `lolTable` (`id`, `createdAt`, `lolType` lol|plus|minus, `fromUser`, `toUser`, `chatId`, `toMessageId`). From Vercel / a one-off script, what are the real options to read that table honestly (IAM keys, export to S3, scan), and what fields are enough to bucket v1 Marks into Seasons?

## Answer

One-shot Scan from a local script or CI (IAM: `DescribeTable` + `Scan` on `lolTable`), transform to v2 Postgres rows tagged `source: v1`, revoke keys after. Fields needed for Seasons: `createdAt`, `lolType`, `fromUser.id`, `toUser.id`, `chatId`, `id`. Reject live DynamoDB queries from Vercel.

Full findings: `docs/research/03-read-v1-dynamodb.md`
