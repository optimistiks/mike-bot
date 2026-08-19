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

## Go-live

Everything you need to run v2 in a real Telegram group. Work through the steps in order.

v1 (`master`, AWS Lambda) stays live until a separate cutover — v2 is a **new BotFather bot** on Vercel. You can run v2 alongside v1 in the same group only if you use the new bot (do not point both bots at the same webhook URL).

**Prerequisites:** Neon account, Vercel account, repo cloned (`pnpm install`), and group admin rights in each target supergroup.

### 1. Neon Postgres

1. Create a project in the [Neon console](https://console.neon.tech/).
2. Open **Connect** → copy the **direct** Postgres connection string (TCP, not the serverless HTTP driver). This becomes `DATABASE_URL` everywhere below.
3. Apply schema migrations to the empty database (run from repo root):

```bash
export DATABASE_URL="postgresql://..."   # Neon direct URL

psql "$DATABASE_URL" -f apps/web/drizzle/0000_init.sql
psql "$DATABASE_URL" -f apps/web/drizzle/0001_registration_messages.sql
```

Tables: `events`, `chat_members`, `chat_memberships`, `message_authors`, `processed_updates`, `registration_messages`.

Production runtime uses `pg` `Pool` + `attachDatabasePool` on Vercel Fluid compute — see `apps/web/lib/db/README.md`. Do not use `@neondatabase/serverless` HTTP for `DATABASE_URL`.

### 2. BotFather — new bot

1. Message `@BotFather` → `/newbot` → create the v2 bot. Save the token as `BOT_TOKEN`.
2. `/setprivacy` → select the bot → **Disable** (privacy mode off so the bot receives all group messages and can cache authors for reactions).
3. Generate a webhook secret: 1–256 characters, only `A-Z`, `a-z`, `0-9`, `_`, `-`. Save as `BOT_WEBHOOK_SECRET`. Use the **same** value for Telegram `setWebhook` and Vercel (next step).

Record the bot `@username` for later.

### 3. Vercel project and deploy

1. [Vercel](https://vercel.com/) → **Add New Project** → import this repo.
2. **Production branch:** `v2`.
3. **Root Directory:** `apps/web` (monorepo; `apps/web/vercel.json` runs install/build from the repo root via pnpm workspaces).
4. **Environment variables** — server-side only. Never use `NEXT_PUBLIC_*` for secrets.

| Variable             | Required | Purpose                                                                |
| -------------------- | -------- | ---------------------------------------------------------------------- |
| `BOT_TOKEN`          | yes      | From BotFather (`/newbot`)                                             |
| `BOT_WEBHOOK_SECRET` | yes      | Same value for `setWebhook.secret_token` and the webhook Route Handler |
| `DATABASE_URL`       | yes      | Neon **direct** TCP connection string from step 1                      |

`WEBHOOK_URL` is **not** a Vercel variable — only for the local `set-webhook` script in step 5.

5. Deploy. Note the production HTTPS origin, e.g. `https://your-project.vercel.app`. This URL is the Mini App, webhook host, and BotFather Menu Button target.

### 4. Import v1 history (optional)

Skip if you do not need DynamoDB history in leaderboards. Run **locally** — not on Vercel. Safe to re-run (`legacy_id` skips duplicates).

```bash
DATABASE_URL="postgresql://..." \
AWS_REGION="eu-west-1" \
AWS_ACCESS_KEY_ID="..." \
AWS_SECRET_ACCESS_KEY="..." \
pnpm --filter @mike-bot/web import:v1
```

| Variable                | Required | Purpose                                                       |
| ----------------------- | -------- | ------------------------------------------------------------- |
| `DATABASE_URL`          | yes†     | Same Neon URL as Vercel                                       |
| `AWS_REGION`            | yes*     | Region of v1 `lolTable` (e.g. `eu-west-1`)                    |
| `AWS_ACCESS_KEY_ID`     | yes      | IAM key with `dynamodb:Scan` on the table                     |
| `AWS_SECRET_ACCESS_KEY` | yes      | Matching secret                                               |
| `LOL_TABLE_NAME`        | no       | Default `lolTable`; CodeStar may suffix (e.g. `-Prod`)        |
| `IMPORT_CHAT_ID`        | no       | Import one chat only (still scans full table)                 |
| `IMPORT_TARGET`         | no       | `pglite` = local PGlite instead of Neon                       |
| `PGLITE_DATA_DIR`       | no       | Persist PGlite files between runs                             |
| `IMPORT_DUMP_DIR`       | no       | Write `events.json`, `chat_members.json`, `leaderboards.json` |

\* `AWS_DEFAULT_REGION` works instead of `AWS_REGION`. † Not required when `IMPORT_TARGET=pglite`.

Do **not** add AWS keys to Vercel. Create a short-lived IAM user, import, then deactivate the access key.

**Where to find AWS values**

- **DynamoDB table:** AWS Console → DynamoDB → Tables → v1 Marks table → **Overview** → Region = `AWS_REGION`, table name = `LOL_TABLE_NAME` if not `lolTable`.
- **Credentials:** IAM → Users → dedicated import user → policy with `dynamodb:Scan` + `dynamodb:DescribeTable` on the table ARN (see `docs/research/03-read-v1-dynamodb.md`).
- **`IMPORT_CHAT_ID`:** Telegram supergroup id (negative, often `-100…`) from v1 context or DynamoDB `chatId` attribute.

**Dry run (no Neon)**

```bash
IMPORT_TARGET=pglite \
AWS_REGION="eu-west-1" \
AWS_ACCESS_KEY_ID="..." \
AWS_SECRET_ACCESS_KEY="..." \
IMPORT_DUMP_DIR=./tmp/import-dump \
pnpm --filter @mike-bot/web import:v1
```

Verify dump:

```bash
jq 'length' tmp/import-dump/events.json
jq '.[0].leaderboard.sections[].title' tmp/import-dump/leaderboards.json
```

Optional filters:

```bash
LOL_TABLE_NAME="lolTable-Prod" pnpm --filter @mike-bot/web import:v1
IMPORT_CHAT_ID="-1001234567890" pnpm --filter @mike-bot/web import:v1
```

### 5. Register the Telegram webhook

After Vercel deployment is live, from repo root:

```bash
BOT_TOKEN="..." \
BOT_WEBHOOK_SECRET="..." \
WEBHOOK_URL="https://your-project.vercel.app/api/telegram" \
pnpm --filter @mike-bot/web set-webhook
```

The script sets `secret_token` and `allowed_updates`: `message`, `message_reaction`, `chat_member` (not `my_chat_member`), then verifies via `getWebhookInfo`. Re-run safely after URL or secret changes.

### 6. BotFather — Menu Button

Mini App opens only from the bot Menu Button (no `/stats`, no inline keyboard).

1. `@BotFather` → `/setmenubutton`
2. Select the v2 bot
3. Button label (e.g. `Таблицы` or `Leaderboards`)
4. URL: production Vercel HTTPS origin from step 3, e.g. `https://your-project.vercel.app`

Use the **production** URL users will hit long-term — preview deployment URLs need their own BotFather entry or a stable alias.

### 7. Each target Telegram group

Repeat for every supergroup that should use v2.

1. **Add the bot** to the group.
2. **Promote to administrator** — required for `message_reaction` updates. Without admin, reactions work in the client but the bot receives nothing.
3. Confirm privacy mode is **off** (step 2) — bot must see messages to cache authors.
4. A **group admin** sends `/register` in the group. The bot posts a registration pin (Russian text).
5. **Members** react to the pin with any emoji → `chat_memberships` row → chat appears in the Mini App picker.
6. **Scoring:** members use 👍 👎 🤣 on others' messages. The bot stays silent. Marks work even for unregistered members; only Mini App access requires the pin reaction.

When a member leaves or is kicked, their registration row is removed automatically (`chat_member` updates).

### 8. Verify

| Check         | How                                                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Webhook       | `set-webhook` printed success; or Telegram `getWebhookInfo` shows your URL and `message_reaction` in `allowed_updates`      |
| Message cache | Send a normal message in the group after the bot joined, then add 👍 on that message — subject should appear on leaderboard |
| Mini App      | Menu Button → Russian UI → chat picker (empty until pin reaction)                                                           |
| Registration  | React to pin → chat appears in picker → five leaderboard sections, Current Season default                                   |
| v1 history    | If imported, older Seasons show imported rows in the Mini App                                                               |

**Common failures**

- Reactions ignored → bot not admin, or webhook missing `message_reaction`, or reaction on a message sent before the bot could cache it.
- Mini App empty chat list → member has not reacted to the registration pin.
- Webhook 401 → `BOT_WEBHOOK_SECRET` mismatch between Vercel and `set-webhook`.
- DB errors on Vercel → wrong `DATABASE_URL` (use Neon direct TCP string).

### Not covered here

- **v1 → v2 cutover** (retire AWS bot, update `master`) — deferred until v2 is proven in production.
- **Neon / Vercel account signup** — use each product's console.
- **Drizzle schema changes** — add new migration SQL under `apps/web/drizzle/` and apply with `psql` like step 1.
