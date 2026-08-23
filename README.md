# Mike-bot v2

Telegram scoring bot and Mini App on Vercel (Next.js + Neon Postgres).

## Development

```bash
pnpm install
pnpm browser:install
pnpm dev
pnpm fmt:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Local database tests use PGlite — no Neon or AWS credentials required.
The browser install provisions Chromium for Vitest Browser Mode.
For persistent local Mini App data, run `cd apps/web && pnpm db:seed`; this
resets and populates the same `.data/pglite` database used by local development.

After seeding, `pnpm dev` mocks a complete Telegram launch in an ordinary local
browser with signed deterministic personas. Open `/?persona=registered` (the
default) for the seeded Chat, `/?persona=unregistered` for the registration
empty state, or `/?persona=forbidden` for a Member limited to the secondary
seeded Chat (requests for the primary Chat return 403). The non-secret dummy
token comes from `apps/web/.env.development` as
`TMA_DEVELOPMENT_BOT_TOKEN`. Next.js loads it only for development; production
accepts only Telegram data signed by `BOT_TOKEN`.

The production Mini App lives at `/chats`. Chat Leaderboards use
`/chats/[chatId]/leaderboards/[year]/[month]` for a Season and
`/chats/[chatId]/leaderboards/[year]` for annual totals. Protected client data
is owned by TanStack Query and partitioned by the authenticated Member and Chat.
The development-only `/api/development/init-data` endpoint signs the personas
above and returns 404 in production.

Telegram remains the source of Chat photos. Postgres stores only Telegram file
references and a stable photo version; `/api/chats/[chatId]/photo` authenticates
the Member, resolves the current Telegram file path, and streams the bytes
without exposing `BOT_TOKEN`. The client keeps the resulting Blob in its
in-memory query cache and falls back to Chat-title initials.

## Layout

- `apps/web` — Next.js App Router app (webhook, Mini App, API)
- `packages/eslint-config` — shared framework-agnostic ESLint config
- `docs/` — ADRs and research

Branch policy: all v2 work on `v2`. Do not commit to `master` (live v1 until cutover).

## Go-live

Everything you need to run v2 in a real Telegram group. Work through the steps in order.

v1 (`master`, AWS Lambda) stays live until a separate cutover — v2 is a **new BotFather bot** on Vercel. You can run v2 alongside v1 in the same group only if you use the new bot (do not point both bots at the same webhook URL).

**Prerequisites:** Vercel account, repo cloned (`pnpm install`), and group admin rights in each target supergroup. You do **not** need a separate Neon account — provision Postgres through Vercel (Vercel-managed integration; billing on your Vercel invoice).

Before publishing `v2`, run `pnpm fmt:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test` from the repository root. All five commands must pass on the exact commit deployed to Vercel.

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
| `DATABASE_URL_UNPOOLED`            | **Direct** TCP string — use for migrations, `psql`, and the local import              |

Do not paste a Neon console connection string manually unless you are debugging. Do not use `@neondatabase/serverless` HTTP for production.

**CLI (optional)**

```bash
vercel link
vercel install neon --name mike-bot-db -e production
```

Choose **Create New Neon Account** when prompted. Then connect the storage resource to the linked project in the dashboard if the CLI did not already.

Pull env vars locally for migrations and import:

```bash
cd apps/web
vercel env pull .env.local
```

Run migration, import, and webhook scripts from `apps/web`. Their direct dotenv
configuration reads `.env.local` first and `.env` second from that workspace.

### 2. Apply database migrations

This repo uses Drizzle [**Option 3**](https://orm.drizzle.team/docs/migrations): TypeScript schema → generated SQL in `apps/web/drizzle/` → `drizzle-kit migrate` applies pending files and records them in Drizzle’s migration journal.

| Context                  | Drizzle pattern                               | Command                         |
| ------------------------ | --------------------------------------------- | ------------------------------- |
| **Production / Neon**    | Option 3 — `generate` + `drizzle-kit migrate` | `pnpm db:migrate` (below)       |
| **Local tests (PGlite)** | Option 4 — same SQL files, runtime migrator   | automatic in `createPgliteDb()` |

After schema changes, work from `apps/web`: `pnpm db:generate` → commit new files under `apps/web/drizzle/` → run `pnpm db:migrate` against each environment.

Apply to **production** once from `apps/web` after `vercel env pull .env.local`. `drizzle.config.ts` reads `.env.local` before `.env` via dotenv and uses `DATABASE_URL_UNPOOLED` when present (direct connection; preferred for migrations):

```bash
cd apps/web
vercel env pull .env.local
pnpm db:migrate
```

Tables: `chats`, `events`, `display_identities`, `registrations`,
`message_authors`, `processed_updates`, `registration_messages`. The `chats`
table holds the latest Telegram title and photo references; it does not store
image bytes.

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

### 5. Import v1 history

The Wayfinder Destination includes v1 history. Run the import **locally** — not on Vercel — in three separate steps, so each one is cheap to repeat and easy to inspect:

```bash
cd apps/web

# 1. DynamoDB -> JSON (the only step needing AWS credentials)
AWS_REGION="eu-west-1" \
AWS_ACCESS_KEY_ID="..." \
AWS_SECRET_ACCESS_KEY="..." \
pnpm import:scan          # writes tmp/v1-rows.json

# 2. JSON -> SQL (no AWS, no database)
pnpm import:sql           # writes tmp/v1-import.sql

# 3. Execute the SQL
pnpm import:run
```

The generated file is plain `INSERT ... ON CONFLICT DO NOTHING` batches — **no transaction**. Every conflict is resolved in memory while generating, so re-running is safe and a killed run resumes where it stopped. `pnpm import:run` sends one statement per round trip and prints progress; `psql -f tmp/v1-import.sql` works identically if you have psql installed.

Read `tmp/v1-import.sql` before step 3 — it is the entire change, in order.

| Variable                | Step | Purpose                                                  |
| ----------------------- | ---- | -------------------------------------------------------- |
| `AWS_REGION`            | scan | Region of v1 `lolTable` (e.g. `eu-west-1`)\*             |
| `AWS_ACCESS_KEY_ID`     | scan | IAM key with `dynamodb:Scan` on the table                |
| `AWS_SECRET_ACCESS_KEY` | scan | Matching secret                                          |
| `LOL_TABLE_NAME`        | scan | Default `lolTable`; CodeStar may suffix (e.g. `-Prod`)   |
| `IMPORT_CHAT_ID`        | scan | Import one chat only (still scans full table)            |
| `IMPORT_JSON`           | both | Path of the JSON dump (default `./tmp/v1-rows.json`)     |
| `IMPORT_SQL`            | both | Path of the SQL file (default `./tmp/v1-import.sql`)     |
| `IMPORT_BATCH_SIZE`     | sql  | Rows per INSERT statement (default 1000)                 |
| `DATABASE_URL`          | run  | From `.env.local` (`DATABASE_URL_UNPOOLED` is preferred) |

\* `AWS_DEFAULT_REGION` works instead of `AWS_REGION`.

Do **not** add AWS keys to Vercel. Create a short-lived IAM user, import, then deactivate the access key.

**Where to find AWS values**

- **DynamoDB table:** AWS Console → DynamoDB → Tables → v1 Marks table → **Overview** → Region = `AWS_REGION`, table name = `LOL_TABLE_NAME` if not `lolTable`.
- **Credentials:** IAM → Users → dedicated import user → policy with `dynamodb:Scan` + `dynamodb:DescribeTable` on the table ARN (see `docs/research/03-read-v1-dynamodb.md`).
- **`IMPORT_CHAT_ID`:** Telegram supergroup id (negative, often `-100…`) from v1 context or DynamoDB `chatId` attribute.

**Verify**

```bash
pnpm import:dump          # writes tmp/import-dump/*.json from the database
jq 'length' tmp/import-dump/events.json
jq '.[0].leaderboard.sections[].title' tmp/import-dump/leaderboards.json
```

Malformed source rows and Message-author conflicts are logged and skipped during step 2, so the SQL file only ever contains rows that convert cleanly.

### 6. Register the Telegram webhook

After Vercel deployment is live, from `apps/web`:

```bash
BOT_TOKEN="..." \
BOT_WEBHOOK_SECRET="..." \
WEBHOOK_URL="https://your-project.vercel.app/api/telegram" \
pnpm set-webhook
```

The script publishes `/stats` and `/register`, sets `secret_token` and `allowed_updates`: `message`, `message_reaction`, `chat_member` (not `my_chat_member`), then verifies via `getWebhookInfo`. Re-run safely after URL or secret changes.

### 7. BotFather — Main Mini App

Configure the production Vercel origin as the bot's **Main Mini App** so Telegram accepts `https://t.me/<bot>?startapp=...` links and supplies `tgWebAppStartParam`.

1. `@BotFather` → select the v2 bot → **Bot Settings** → **Configure Mini App**.
2. Enable the Main Mini App and set its URL to the production Vercel HTTPS origin from step 4, e.g. `https://your-project.vercel.app`.
3. Optionally configure the same URL as the Menu Button for an additional entry point.

Use the **production** URL users will hit long-term — preview deployment URLs need their own BotFather entry or a stable alias.

### 8. Each target Telegram group

Repeat for every supergroup that should use v2.

1. **Add the bot** to the group.
2. **Promote to administrator, with _Delete messages_** — admin is required for `message_reaction` updates (without it, reactions work in the client but the bot receives nothing), and the delete permission is what lets the bot replace an accepted `+`/`-`/`лол` reply with its own message.
3. Confirm privacy mode is **off** (step 3) — bot must see messages to cache authors.
4. **Mark `/stats` and `/register` ephemeral** in @BotFather so the command messages stay invisible to the rest of the group. `set-webhook` publishes them with `is_ephemeral` for the group scope.
5. **Members** send `/stats` (or its `/register` alias). In a group it creates Registration and replies ephemerally — visible only to the caller — with a deep link to that Chat's current Leaderboard; private `/stats` opens the Chat picker.
6. **Scoring:** Members use 👍 👎 🤣 reactions, or exact `+`, `-`, `лол` replies, on others' messages. An accepted reply is deleted and the bot answers under the marked message with `➕ (name)`, `➖ (name)`, or `лол (name)` — the name is not an `@` mention, so nobody is notified. Reaction Marks can be undone; reply and imported Marks cannot.

When a member leaves or is kicked, their registration row is removed automatically (`chat_member` updates).

### 9. Verify

| Check         | How                                                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Webhook       | `set-webhook` printed success; or Telegram `getWebhookInfo` shows your URL and `message_reaction` in `allowed_updates`      |
| Message cache | Send a normal message in the group after the bot joined, then add 👍 on that message — subject should appear on leaderboard |
| Mini App      | Main Mini App or `/stats` → Chat picker/deep link → Chat photo/title → five Leaderboard sections                            |
| Registration  | Send `/stats` in the group → only you see the reply → Chat appears in picker → Current Season opens by default              |
| Periods       | Season drawer → monthly and annual URLs; empty months remain selectable                                                     |
| v1 history    | If imported, older Seasons and their annual totals show imported rows in the Mini App                                       |

**Common failures**

- Reactions ignored → bot not admin, or webhook missing `message_reaction`, or reaction on a message sent before the bot could cache it.
- Mini App empty Chat list → Member has not used `/stats` or `/register` in that Chat.
- Webhook 401 → `BOT_WEBHOOK_SECRET` mismatch between Vercel and `set-webhook`.
- DB errors on Vercel → Neon integration not connected to the project, or `DATABASE_URL` was overwritten manually (should be the pooled URL from the integration).

### Not covered here

- **v1 → v2 cutover** (retire AWS bot, update `master`) — deferred until v2 is proven in production.
- **Drizzle schema changes** — `pnpm --filter @mike-bot/web db:generate`, commit SQL under `apps/web/drizzle/`, then `db:migrate` with `DATABASE_URL_UNPOOLED` like step 2.
- **Neon-Managed integration** (link an existing Neon account) — only if you want Neon billing; this guide assumes Vercel-managed.
