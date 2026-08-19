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

**Prerequisites:** Vercel account, repo cloned (`pnpm install`), and group admin rights in each target supergroup. You do **not** need a separate Neon account — provision Postgres through Vercel (Vercel-managed integration; billing on your Vercel invoice).

### 1. Vercel project and Vercel-managed Neon Postgres

Use the **Vercel-Managed** Neon integration (Marketplace → **Neon Postgres** → **Create New Neon Account**). Do **not** use the Neon-Managed path (“connect existing Neon account”) unless you explicitly want Neon billing and a linked Neon project.

**Dashboard**

1. [Vercel](https://vercel.com/) → **Add New Project** → import this repo.
2. **Production branch:** `v2`.
3. **Root Directory:** `apps/web` (monorepo; `apps/web/vercel.json` runs install/build from the repo root via pnpm workspaces).
4. [Neon on Vercel Marketplace](https://vercel.com/marketplace/neon) → **Install** → choose **Create New Neon Account** → pick region/plan → name the database.
5. **Storage** → your database → **Connect Project** → select this Vercel project → enable **Production** (and **Preview** only if you want isolated preview DB branches).
6. Vercel injects connection env vars automatically. You only need to add bot secrets in step 3.

| Variable (injected by integration) | Purpose                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| `DATABASE_URL`                     | **Pooled** TCP string — used by the deployed app (`pg` `Pool` + `attachDatabasePool`) |
| `DATABASE_URL_UNPOOLED`            | **Direct** TCP string — use for migrations, `psql`, and local `import:v1`             |

Do not paste a Neon console connection string manually unless you are debugging. Do not use `@neondatabase/serverless` HTTP for production.

**CLI (optional)**

```bash
vercel link
vercel install neon --name mike-bot-db -e production
```

Choose **Create New Neon Account** when prompted. Then connect the storage resource to the linked project in the dashboard if the CLI did not already.

Pull env vars locally for migrations and import:

```bash
vercel env pull .env.local
```

### 2. Apply database migrations

This repo uses Drizzle [**Option 3**](https://orm.drizzle.team/docs/migrations): TypeScript schema → generated SQL in `apps/web/drizzle/` → `drizzle-kit migrate` applies pending files and records them in Drizzle’s migration journal.

| Context                  | Drizzle pattern                               | Command                         |
| ------------------------ | --------------------------------------------- | ------------------------------- |
| **Production / Neon**    | Option 3 — `generate` + `drizzle-kit migrate` | `pnpm db:migrate` (below)       |
| **Local tests (PGlite)** | Option 4 — same SQL files, runtime migrator   | automatic in `createPgliteDb()` |

After schema changes: `pnpm --filter @mike-bot/web db:generate` → commit new files under `apps/web/drizzle/` → run `db:migrate` against each environment.

Apply to **production** once after `vercel env pull .env.local` (repo root or `apps/web` — both are read). `drizzle.config.ts` loads `.env` files via dotenv and uses `DATABASE_URL_UNPOOLED` when present (direct connection; preferred for migrations):

```bash
vercel env pull .env.local
pnpm --filter @mike-bot/web db:migrate
```

Tables: `events`, `chat_members`, `chat_memberships`, `message_authors`, `processed_updates`, `registration_messages`.

Production runtime uses `pg` `Pool` + `attachDatabasePool` on Vercel Fluid compute — see `apps/web/lib/db/README.md`.

### 3. BotFather — new bot

1. Message `@BotFather` → `/newbot` → create the v2 bot. Save the token as `BOT_TOKEN`.
2. `/setprivacy` → select the bot → **Disable** (privacy mode off so the bot receives all group messages and can cache authors for reactions).
3. Generate a webhook secret: 1–256 characters, only `A-Z`, `a-z`, `0-9`, `_`, `-`. Save as `BOT_WEBHOOK_SECRET`. Use the **same** value for Telegram `setWebhook` and Vercel (next step).

Record the bot `@username` for later.

### 4. Bot env vars and deploy

In the Vercel project → **Settings → Environment Variables**, add (server-side only — never `NEXT_PUBLIC_*`):

| Variable             | Required | Purpose                                                                |
| -------------------- | -------- | ---------------------------------------------------------------------- |
| `BOT_TOKEN`          | yes      | From BotFather (`/newbot`)                                             |
| `BOT_WEBHOOK_SECRET` | yes      | Same value for `setWebhook.secret_token` and the webhook Route Handler |

`DATABASE_URL` should already exist from step 1. Do not replace it with a hand-copied URL.

`WEBHOOK_URL` is **not** a Vercel variable — only for the local `set-webhook` script in step 6.

Deploy (or redeploy after adding env vars). Note the production HTTPS origin, e.g. `https://your-project.vercel.app`. This URL is the Mini App, webhook host, and BotFather Menu Button target.

### 5. Import v1 history (optional)

Skip if you do not need DynamoDB history in leaderboards. Run **locally** — not on Vercel. Safe to re-run (`legacy_id` skips duplicates).

Use the direct connection from `.env.local` (`DATABASE_URL_UNPOOLED` is picked up automatically after `vercel env pull`):

```bash
AWS_REGION="eu-west-1" \
AWS_ACCESS_KEY_ID="..." \
AWS_SECRET_ACCESS_KEY="..." \
pnpm --filter @mike-bot/web import:v1
```

| Variable                | Required | Purpose                                                       |
| ----------------------- | -------- | ------------------------------------------------------------- |
| `DATABASE_URL`          | yes†     | From `.env.local` (`DATABASE_URL_UNPOOLED` or `DATABASE_URL`) |
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

### 6. Register the Telegram webhook

After Vercel deployment is live, from repo root:

```bash
BOT_TOKEN="..." \
BOT_WEBHOOK_SECRET="..." \
WEBHOOK_URL="https://your-project.vercel.app/api/telegram" \
pnpm --filter @mike-bot/web set-webhook
```

The script sets `secret_token` and `allowed_updates`: `message`, `message_reaction`, `chat_member` (not `my_chat_member`), then verifies via `getWebhookInfo`. Re-run safely after URL or secret changes.

### 7. BotFather — Menu Button

Mini App opens only from the bot Menu Button (no `/stats`, no inline keyboard).

1. `@BotFather` → `/setmenubutton`
2. Select the v2 bot
3. Button label (e.g. `Таблицы` or `Leaderboards`)
4. URL: production Vercel HTTPS origin from step 4, e.g. `https://your-project.vercel.app`

Use the **production** URL users will hit long-term — preview deployment URLs need their own BotFather entry or a stable alias.

### 8. Each target Telegram group

Repeat for every supergroup that should use v2.

1. **Add the bot** to the group.
2. **Promote to administrator** — required for `message_reaction` updates. Without admin, reactions work in the client but the bot receives nothing.
3. Confirm privacy mode is **off** (step 3) — bot must see messages to cache authors.
4. A **group admin** sends `/register` in the group. The bot posts a registration pin (Russian text).
5. **Members** react to the pin with any emoji → `chat_memberships` row → chat appears in the Mini App picker.
6. **Scoring:** members use 👍 👎 🤣 on others' messages. The bot stays silent. Marks work even for unregistered members; only Mini App access requires the pin reaction.

When a member leaves or is kicked, their registration row is removed automatically (`chat_member` updates).

### 9. Verify

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
- DB errors on Vercel → Neon integration not connected to the project, or `DATABASE_URL` was overwritten manually (should be the pooled URL from the integration).

### Not covered here

- **v1 → v2 cutover** (retire AWS bot, update `master`) — deferred until v2 is proven in production.
- **Drizzle schema changes** — `pnpm --filter @mike-bot/web db:generate`, commit SQL under `apps/web/drizzle/`, then `db:migrate` with `DATABASE_URL_UNPOOLED` like step 2.
- **Neon-Managed integration** (link an existing Neon account) — only if you want Neon billing; this guide assumes Vercel-managed.
