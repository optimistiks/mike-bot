# Research: How do we read v1 DynamoDB Marks?

**Ticket:** [How do we read v1 DynamoDB Marks?](../../.scratch/v2/issues/03-read-v1-dynamodb.md)  
**Status:** Research complete  
**Date:** 2026-08-18

## Question

v1 stores Marks in DynamoDB table `lolTable`. From Vercel or a one-off script, what are the real options to read that table, and which fields are enough to bucket v1 Marks into Seasons for the Mini App?

## Summary

| Approach | Best for | Verdict |
| --- | --- | --- |
| One-off Node script + IAM user keys (Scan) | Small table, cutover import | **Recommended** |
| AWS CLI one-off Scan → JSON file | Same as above, no code | Good alternative |
| DynamoDB export to S3 | Large table, audit trail, repeat exports | Overkill unless table is huge or PITR already on |
| Live Scan/Query from Vercel | Ongoing reads | **Reject** — keeps v1 AWS on the hot path |

**Recommendation:** Run a **one-shot import** from a local machine or CI job (not the Vercel runtime). Scan `lolTable`, transform rows into v2 Postgres Marks tagged `source: v1`, then **delete the IAM user** (or revoke keys). Do not live-query DynamoDB from Vercel for Mini App stats ([issue 08](../../.scratch/v2/issues/08-v1-history-path.md)).

---

## v1 table and record shape

### Infrastructure (`template.yml`)

- Table name: **`lolTable`** (CloudFormation logical id `LolTable`).
- Resource type: `AWS::Serverless::SimpleTable` — a single-partition-key DynamoDB table with **no GSIs**.
- Default primary key: attribute **`id`**, type **String** ([AWS SAM SimpleTable docs](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-resource-simpletable.html)).
- Billing: not overridden → **on-demand (pay per request)** ([SAM SimpleTable](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-resource-simpletable.html)).
- Lambda receives `LOL_TABLE_NAME` env var pointing at this table; the execution role uses **`AmazonDynamoDBFullAccess`** (broader than we need for import).

Sources: [`template.yml`](../../template.yml) lines 42, 69–73.

### Application model (`lolModel.ts`)

```typescript
@Model({ tableName: process.env.LOL_TABLE_NAME })
export class Lol {
  @PartitionKey()
  id: string;                    // UUID v4

  @Property({ mapper: dateToNumberMapper })
  createdAt: Date;               // stored as Number (epoch ms)

  lolType: LolType;              // "lol" | "plus" | "minus"
  fromUser: User;                // { id: number, username?: string }
  toUser: User;
  chatId: number;
  toMessageId: number;
}
```

Sources: [`src/lolModel.ts`](../../src/lolModel.ts), [`src/bot.ts`](../../src/bot.ts) (`createLolFromCtx`, `/stats` scan).

### Raw DynamoDB item shape (dynamo-easy serialization)

`@shiftcoders/dynamo-easy@7.0.0` stores:

| Field | DynamoDB type | Notes |
| --- | --- | --- |
| `id` | `S` | UUID string (partition key) |
| `createdAt` | `N` | Unix epoch **milliseconds** (`dateToNumberMapper`) |
| `lolType` | `S` | `"lol"`, `"plus"`, or `"minus"` |
| `fromUser` | `M` | `{ id: N, username?: S }` |
| `toUser` | `M` | `{ id: N, username?: S }` |
| `chatId` | `N` | Telegram chat id (negative for supergroups) |
| `toMessageId` | `N` | Target message id |

Example item (illustrative):

```json
{
  "id": { "S": "a1b2c3d4-e5f6-7890-abcd-ef1234567890" },
  "createdAt": { "N": "1690000000123" },
  "lolType": { "S": "plus" },
  "fromUser": { "M": { "id": { "N": "111" }, "username": { "S": "alice" } } },
  "toUser": { "M": { "id": { "N": "222" }, "username": { "S": "bob" } } },
  "chatId": { "N": "-1001234567890" },
  "toMessageId": { "N": "42" }
}
```

Source: dynamo-easy `dateToNumberMapper` ([`date-to-number.mapper.js`](https://unpkg.com/@shiftcoders/dynamo-easy@7.0.0/dist/mapper/custom/date-to-number.mapper.js) — `toDb` writes `{ N: "" + modelValue.getTime() }`).

### v1 → v2 field mapping

| v1 | v2 concept | Notes |
| --- | --- | --- |
| `lolType: "plus"` | Karma plus Mark | +1 Karma to `toUser` |
| `lolType: "minus"` | Karma minus Mark | −1 Karma to `toUser` |
| `lolType: "lol"` | Humor Mark | +1 Humor to `toUser` |
| `fromUser.id` | Mark author (Member) | For “given” leaderboards |
| `toUser.id` | Mark target (Member) | For “received” leaderboards |
| `createdAt` | Season bucket | Calendar month in a **single configured timezone** (open decision — [issue 10](../../.scratch/v2/issues/10-season-timezone.md)) |
| `chatId` | Chat filter | v1 `/stats` already filters by `ctx.chat.id`; import should filter to the target group if v2 is single-chat |
| `id` | Import dedup key | Stable v1 primary key → idempotent upsert |
| `toMessageId` | Not needed for Season totals | Useful for audit/debug only |
| `*.username` | Display / PII | Optional at import; can refresh from Telegram later |

### Fields required for honest Seasonal bucketing

**Minimum to compute Season leaderboards:**

1. **`createdAt`** — assign Mark to Season (`YYYY-MM` in chosen timezone).
2. **`lolType`** — split Karma plus / Karma minus / Humor counts.
3. **`fromUser.id`** and **`toUser.id`** — per-Member received and given stats.
4. **`chatId`** — if importing only one group’s history (recommended until [issue 09](../../.scratch/v2/issues/09-chats-and-language.md) decides otherwise).

**Strongly recommended for import integrity:**

5. **`id`** — prevent duplicate rows on re-run.

**Not required for aggregation:**

- `toMessageId`, usernames (PII; see Risks).

v1 `/stats` already proves the aggregation logic: scan by `chatId`, aggregate by `lolType` and user ids ([`src/bot.ts`](../../src/bot.ts) lines 132–176). v2 differs only in **Season filter on `createdAt`** and **no Humor decay** ([ADR 0003](../adr/0003-honest-seasonal-stats.md)).

---

## Options to read `lolTable` from outside Lambda

### 1. IAM user keys + AWS SDK Scan (Node script)

**How it works:** Create a dedicated IAM user (or role assumed from CI) with `dynamodb:Scan` on `lolTable`. Run a Node/TS script locally or in GitHub Actions using `@aws-sdk/client-dynamodb` + `@aws-sdk/lib-dynamodb`, paginate `Scan`, optionally `FilterExpression` on `chatId`, write to v2 Postgres.

**Pros**

- Matches how v1 already reads data (`lolStore.scan()` in [`bot.ts`](../../src/bot.ts)).
- Simple for a small friends-group table (likely thousands of rows, not millions).
- No PITR prerequisite.
- Credentials never need to touch Vercel.

**Cons**

- Full table scan; filter on `chatId` still reads every item ([Scan billing](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Scan.html)).
- Must paginate (`LastEvaluatedKey`) for tables &gt; 1 MB per page.

**Sketch**

```typescript
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "..." }));
let items = [];
let ExclusiveStartKey;
do {
  const out = await client.send(new ScanCommand({
    TableName: "lolTable",
    ExclusiveStartKey,
    // FilterExpression: "chatId = :c", ExpressionAttributeValues: { ":c": TARGET_CHAT_ID },
  }));
  items.push(...(out.Items ?? []));
  ExclusiveStartKey = out.LastEvaluatedKey;
} while (ExclusiveStartKey);
```

Unmarshall nested `M` attributes or use `DynamoDBDocumentClient` with `marshallOptions: { convertEmptyValues: true }`.

### 2. DynamoDB export to S3

**How it works:** Enable **Point-in-Time Recovery (PITR)** on the table, then `ExportTableToPointInTime` to an S3 bucket. Output is **DynamoDB JSON** or Ion; parse offline and load Postgres.

**Pros**

- Does not consume table RCUs; export is async and managed ([Export to S3](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/S3DataExport.HowItWorks.html)).
- Good for very large tables or repeatable incremental exports.

**Cons**

- **PITR must be enabled first** — not in current `template.yml`; enabling adds ongoing cost (~$0.20/GB-month) ([PITR pricing](https://aws.amazon.com/dynamodb/pricing/)).
- Export fee ~$0.10/GB of table data ([export pricing](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/S3DataExport.HowItWorks.html)).
- More moving parts: S3 bucket, KMS, parsing DynamoDB JSON, cleanup.
- Overkill for a single cutover of a small social-group table.

**When to use:** Table is large (hundreds of MB+), PITR already on, or compliance requires S3 archive before import.

### 3. AWS CLI one-off Scan

**How it works:**

```bash
aws dynamodb scan \
  --table-name lolTable \
  --region eu-west-1 \
  --output json \
  > lolTable-export.json
```

Paginate with `--starting-token` / `--page-size` or a shell loop on `LastEvaluatedKey`.

**Pros**

- Fastest manual path; no deploy.
- Same IAM permissions as SDK Scan.

**Cons**

- Large output file; must parse DynamoDB JSON (`{ "S": "..." }` wrappers).
- Easy to hit shell memory limits on huge tables (unlikely here).

Good **ad-hoc inspection** or **backup before import**; for production import, prefer the Node script with typed transform + Postgres load.

### 4. Live query from Vercel

**How it works:** Store `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (or OIDC-assumed role) in Vercel env vars; Scan/Query DynamoDB on each Mini App request.

**Verdict: Reject.**

- Keeps v1 AWS infrastructure on the **hot path** for v2 ([issue 08](../../.scratch/v2/issues/08-v1-history-path.md)).
- v1 table has **no GSI on `chatId` or `createdAt`** — every stats request is a full Scan (same as v1 `/stats`, but now from serverless at scale).
- Adds latency, cost, and failure domain to every Mini App load.
- Forces long-lived AWS credentials (or OIDC plumbing) in Vercel for data that is **immutable history**.

---

## One-shot import vs live query

| | One-shot import | Live DynamoDB from Vercel |
| --- | --- | --- |
| Mini App query path | Single Postgres store (v1 + v2 Marks) | Two backends or proxy layer |
| AWS dependency after cutover | None (table can stay read-only archive) | Permanent |
| Season queries | Indexed SQL on `created_at`, `season` | Scan or new GSI project |
| Cost at steady state | Postgres only | Scan RCUs + Vercel + AWS on every read |
| Credential exposure | Short-lived import job | Ongoing in Vercel |

**Recommendation:** **One-shot import** into the same Postgres store as v2 Marks, with a `source = 'v1'` (or similar) column. Re-run import only if v1 stays live during a transition window; final cutover imports once, validates counts, then freeze v1 writes.

Import transform (conceptual):

```
season = formatInTimeZone(createdAt, CONFIG_TZ, 'yyyy-MM')
mark_type = map(lolType)  // plus → karma_plus, minus → karma_minus, lol → humor
from_member_id = fromUser.id
to_member_id = toUser.id
v1_id = id  // unique constraint for idempotency
```

---

## Minimal IAM permissions

### Option A — Scan import (recommended)

Dedicated IAM user or CI OIDC role, **no** `AmazonDynamoDBFullAccess`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DescribeLolTable",
      "Effect": "Allow",
      "Action": "dynamodb:DescribeTable",
      "Resource": "arn:aws:dynamodb:REGION:ACCOUNT_ID:table/lolTable"
    },
    {
      "Sid": "ScanLolTable",
      "Effect": "Allow",
      "Action": "dynamodb:Scan",
      "Resource": "arn:aws:dynamodb:REGION:ACCOUNT_ID:table/lolTable"
    }
  ]
}
```

Replace `REGION` and `ACCOUNT_ID`. If the physical table name is suffixed by CodeStar stage, use the **actual** table name from the AWS console (logical name in SAM is `lolTable`; deployed name may differ).

Optional read-only sanity check: add `dynamodb:DescribeContinuousBackups` only if evaluating export path.

### Option B — Export to S3 (if used)

Additional actions per [AWS export docs](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/S3DataExport_Requesting.html):

- `dynamodb:ExportTableToPointInTime` on the table ARN
- `s3:PutObject`, `s3:AbortMultipartUpload`, `s3:PutObjectAcl` on destination bucket/prefix
- KMS `kms:Decrypt`, `kms:GenerateDataKey` if bucket/table uses CMK

### After import

- Delete IAM user or deactivate access keys.
- Do **not** grant Vercel functions Scan on production `lolTable`.

---

## Risks

### Scan cost

- On-demand billing: Scan charges by **data read** (RRUs in 4 KB chunks), not rows returned ([Scan](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Scan.html), [pricing](https://aws.amazon.com/dynamodb/pricing/)).
- `FilterExpression` on `chatId` does **not** reduce RCUs — DynamoDB reads the whole table ([Scan](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Scan.html)).
- For a small group bot (estimate **&lt; 50 MB** table), a **single full Scan** costs cents or less. Risk is **operational** (repeated scans, accidental loops), not bill shock.
- Mitigation: run import **once**; use `ReturnConsumedCapacity: TOTAL` in dev to measure; add script guard against double-run without idempotent upsert on `v1_id`.

### PII and Telegram identifiers

- Each Mark stores **Telegram user ids** (`fromUser.id`, `toUser.id`) and optional **usernames**.
- Usernames change; ids are stable. Treat export files and import logs as **sensitive** — restrict S3/object storage, delete local JSON after load.
- Mini App may not need to persist usernames if it resolves display names from Telegram `initData` or a Members table at read time.

### Credentials in Vercel

- Vercel env vars are **encrypted at rest** and not exposed to the client ([Vercel env vars](https://vercel.com/docs/environment-variables)).
- Storing long-lived `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` in Vercel is an **anti-pattern**: broad blast radius if leaked, no automatic rotation ([Vercel OIDC blog](https://vercel.com/blog/enhancing-security-of-backend-connectivity-with-openid-connect)).
- Preferred on Vercel: **OIDC federation** → short-lived creds via `AssumeRoleWithWebIdentity` ([Vercel AWS OIDC](https://vercel.com/docs/oidc/aws)) — but that is for ongoing AWS access, which we are avoiding for v1 history.
- **Best practice for this project:** run the v1 import **outside Vercel** (developer laptop, GitHub Actions with repo secrets, or one-off Cloud Shell). Never add DynamoDB Scan keys to Vercel production env.

### Other

- **Timezone:** Season boundaries for v1 `createdAt` must match v2 config ([issue 10](../../.scratch/v2/issues/10-season-timezone.md)) — wrong TZ shifts Marks across month boundaries.
- **Table name / region:** Confirm deployed region and exact table name in the v1 AWS account (CodeStar stack).
- **Transition window:** If v1 and v2 run in parallel, either re-import delta before cutover or accept a gap in v1 history.

---

## Recommended cutover procedure

1. Confirm `lolTable` region, item count (`aws dynamodb describe-table`), and target `chatId`.
2. Create scoped IAM user; run Scan import script → staging Postgres.
3. Validate: row count vs DynamoDB `ItemCount`, spot-check Season totals vs manual sample, compare v1 `/stats` all-time Karma/Humor (no decay) for the target chat.
4. Load production Postgres with `source = 'v1'`; unique on `v1_id`.
5. Revoke IAM keys; keep DynamoDB table as read-only archive or decommission after confidence period.

---

## Sources

| Claim | Source |
| --- | --- |
| v1 Mark fields and types | [`src/lolModel.ts`](../../src/lolModel.ts) |
| UUID id, createdAt, chatId, write path | [`src/bot.ts`](../../src/bot.ts) |
| Table name `lolTable`, Lambda env, IAM | [`template.yml`](../../template.yml) |
| `createdAt` stored as epoch ms Number | dynamo-easy `dateToNumberMapper` |
| SimpleTable default key `id` String | [AWS SAM SimpleTable](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-resource-simpletable.html) |
| Scan RCU / filter behavior | [DynamoDB Scan](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Scan.html) |
| Export requires PITR | [Export to S3](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/S3DataExport_Requesting.html) |
| Vercel OIDC vs static keys | [Vercel AWS OIDC](https://vercel.com/docs/oidc/aws) |
| One-shot import preference | [issue 08](../../.scratch/v2/issues/08-v1-history-path.md), [ADR 0003](../adr/0003-honest-seasonal-stats.md) |
| Season timezone open decision | [issue 10](../../.scratch/v2/issues/10-season-timezone.md) |
