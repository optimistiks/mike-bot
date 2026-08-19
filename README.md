# Mike-bot v2

Telegram scoring bot and Mini App on Vercel (Next.js + Neon Postgres).

## Development

```bash
pnpm install
pnpm dev
pnpm test
pnpm build
pnpm lint
pnpm fmt
```

Local database tests use PGlite — no Neon or AWS credentials required.

## Layout

- `apps/web` — Next.js App Router app (webhook, Mini App, API)
- `packages/eslint-config` — shared framework-agnostic ESLint config
- `docs/` — ADRs and research
- `.scratch/v2/` — spec and implementation tickets

Branch policy: all v2 work on `v2`. Do not commit to `master` (live v1 until cutover).

## Production deploy (Vercel)

Deploy target is `apps/web` on the `v2` branch. In the Vercel project, set **Root Directory** to `apps/web` (or import the repo and choose that path). `apps/web/vercel.json` uses the default Next.js build; install runs from the monorepo root via pnpm workspaces.

### Server environment variables

Set these in Vercel **only as server-side env vars** — never `NEXT_PUBLIC_*` for secrets (the Mini App client must not receive bot or database credentials).

| Variable             | Required | Purpose                                                                |
| -------------------- | -------- | ---------------------------------------------------------------------- |
| `BOT_TOKEN`          | yes      | Telegram bot token from BotFather                                      |
| `BOT_WEBHOOK_SECRET` | yes      | Shared secret for `setWebhook.secret_token` and `webhookCallback`      |
| `DATABASE_URL`       | yes      | Neon Postgres **direct** TCP connection string (same as import script) |

Production database access uses `pg` `Pool` + `attachDatabasePool` from `@vercel/functions` on Vercel Fluid compute (see `apps/web/lib/db/README.md`). Do not use the `@neondatabase/serverless` HTTP driver.

`WEBHOOK_URL` is **not** a Vercel runtime variable — it is only for the local `set-webhook` script below.

### Human deploy checklist

1. **Bot in each target group** — Add the new BotFather bot; promote to **administrator** (required for `message_reaction`). Privacy mode **off**. Record `@username`.
2. **Vercel** — Deploy from `v2` with Root Directory `apps/web`. Set `BOT_TOKEN`, `BOT_WEBHOOK_SECRET`, and `DATABASE_URL` as server env vars.
3. **BotFather** — Menu Button → production HTTPS origin (the Vercel deployment URL, same host as the Mini App).
4. **Webhook** — Run `set-webhook` locally (or from CI) with `WEBHOOK_URL` pointing at `https://<deployment>/api/telegram`.
5. **Registration** — Group admins run `/register` in each chat to post the registration pin; members react to the pin to appear in the Mini App picker.
6. **v1 import (optional)** — Run the import script locally with temporary AWS creds before or after go-live (not on Vercel runtime).

### Register the Telegram webhook

After the Vercel deployment is live:

```bash
BOT_TOKEN="..." \
BOT_WEBHOOK_SECRET="..." \
WEBHOOK_URL="https://your-app.vercel.app/api/telegram" \
pnpm --filter @mike-bot/web set-webhook
```

The script calls `setWebhook` with `secret_token` and `allowed_updates` of `message`, `message_reaction`, and `chat_member` (not `my_chat_member`), then verifies via `getWebhookInfo`.

## v1 history import

One-shot script that copies v1 DynamoDB Marks into v2 Postgres. Run **locally** — not on Vercel. Safe to re-run: rows with the same v1 `id` are skipped via `legacy_id`.

### Run

From the repo root, after `pnpm install`:

```bash
DATABASE_URL="postgresql://..." \
AWS_REGION="eu-west-1" \
AWS_ACCESS_KEY_ID="..." \
AWS_SECRET_ACCESS_KEY="..." \
pnpm --filter @mike-bot/web import:v1
```

Optional filters:

```bash
# If the deployed table name differs from the SAM default
LOL_TABLE_NAME="lolTable-Prod" pnpm --filter @mike-bot/web import:v1

# Import one Telegram group only (still scans the whole table; filter is applied client-side)
IMPORT_CHAT_ID="-1001234567890" pnpm --filter @mike-bot/web import:v1
```

On success the script prints counts for rows processed, events inserted/skipped, and `chat_members` upserts.

### Environment variables

| Variable                | Required | Purpose                                                                    |
| ----------------------- | -------- | -------------------------------------------------------------------------- |
| `DATABASE_URL`          | yes†     | Neon Postgres TCP connection string for the v2 database                    |
| `AWS_REGION`            | yes*     | AWS region where v1 `lolTable` lives                                       |
| `AWS_ACCESS_KEY_ID`     | yes      | IAM access key with `dynamodb:Scan` on the table                           |
| `AWS_SECRET_ACCESS_KEY` | yes      | Matching secret for the access key                                         |
| `LOL_TABLE_NAME`        | no       | DynamoDB table name (default: `lolTable`)                                  |
| `IMPORT_CHAT_ID`        | no       | Numeric Telegram chat id; import only rows for that chat                   |
| `IMPORT_TARGET`         | no       | Set to `pglite` to import into local PGlite instead of Neon                |
| `PGLITE_DATA_DIR`       | no       | Directory for file-backed PGlite (default: in-memory)                      |
| `IMPORT_DUMP_DIR`       | no       | Write `events.json`, `chat_members.json`, `leaderboards.json` after import |

\* `AWS_DEFAULT_REGION` works instead of `AWS_REGION`.

† Not required when `IMPORT_TARGET=pglite`.

Do **not** add AWS keys to Vercel. Create a short-lived IAM user for the import, then delete or deactivate the access key when done.

### Where to find values

**`DATABASE_URL` (Neon, not AWS)**

1. Open the [Neon console](https://console.neon.tech/) → your project → **Connect**.
2. Copy the **direct** Postgres connection string (not the serverless HTTP driver).
3. Use the same value as the Vercel `DATABASE_URL` for the environment you are importing into.

**`AWS_REGION` and `LOL_TABLE_NAME`**

1. AWS Console → **DynamoDB** → **Tables**.
2. Open the v1 Marks table (SAM logical name `lolTable`; CodeStar may suffix it, e.g. `lolTable-Prod`).
3. **Overview** tab → note **Amazon Resource Name (ARN)** and **Region**.
   - Region is the value for `AWS_REGION` (e.g. `eu-west-1`).
   - Table name at the top of the page is `LOL_TABLE_NAME` if it is not exactly `lolTable`.

**`IMPORT_CHAT_ID` (optional)**

Telegram supergroup ids are negative numbers (often `-100…`). If you only care about one group, use that chat’s id. You can confirm it from v1 `/stats` context or from sample rows in DynamoDB (`chatId` attribute).

**AWS credentials (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`)**

1. AWS Console → **IAM** → **Users** → create a dedicated import user (or select an existing one).
2. Attach a policy allowing `dynamodb:Scan` and `dynamodb:DescribeTable` on the table ARN from the DynamoDB overview (see `docs/research/03-read-v1-dynamodb.md` for a minimal policy).
3. **Security credentials** tab → **Create access key** → copy the key id and secret into your shell (or `~/.aws/credentials`).
4. After import completes, deactivate or delete the access key.

**Account id (for IAM policy ARNs only)**

AWS Console → top-right account menu → **Account** — or IAM → **Dashboard** → **Account ID**. Use it when scoping the DynamoDB table ARN in the IAM policy (`arn:aws:dynamodb:REGION:ACCOUNT_ID:table/...`).

### Dry run with PGlite (no Neon)

Scan real v1 DynamoDB into local PGlite and dump JSON you can inspect. AWS credentials are still required; only `DATABASE_URL` is skipped.

```bash
IMPORT_TARGET=pglite \
AWS_REGION="eu-west-1" \
AWS_ACCESS_KEY_ID="..." \
AWS_SECRET_ACCESS_KEY="..." \
IMPORT_DUMP_DIR=./tmp/import-dump \
pnpm --filter @mike-bot/web import:v1
```

Optional: persist PGlite on disk between runs:

```bash
PGLITE_DATA_DIR=./tmp/pglite-data IMPORT_TARGET=pglite ...
```

**Verify the dump**

The script writes three files under `IMPORT_DUMP_DIR`:

| File                | Contents                                                      |
| ------------------- | ------------------------------------------------------------- |
| `events.json`       | Imported `events` rows (`type`, `legacy_id`, `created_at`, …) |
| `chat_members.json` | Seeded display names                                          |
| `leaderboards.json` | Five Russian sections per chat × Season (`Europe/Moscow`)     |

Quick checks:

```bash
jq 'length' tmp/import-dump/events.json
jq '.[0].leaderboard.sections[].title' tmp/import-dump/leaderboards.json
jq '.[0].leaderboard.sections[0].entries' tmp/import-dump/leaderboards.json
```

Re-running the same import is safe (`legacy_id` skips duplicates). Delete `tmp/import-dump` or `tmp/pglite-data` to start fresh.
