# Mike-bot v2

Telegram scoring bot on Vercel (Hono + grammY + Neon Postgres). Members mark
each other's messages, print Standings with `/stats`, and talk to the bot in a
Conversation until they say `довольно`.

The Next.js Mini App in `apps/web` is frozen unused source. Do not deploy it.

## Development

```bash
pnpm install
pnpm fmt:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Bot tests use PGlite and MSW — no Neon, AWS, Telegram, or AI Gateway
credentials required. `pnpm test` runs the bot's ten update-handler tests
only. The frozen Mini App in `apps/web` is not a workspace package.

To run the Hono app locally the same way Vercel serves it in production,
install the [Vercel CLI](https://vercel.com/docs/cli) globally, then from
`apps/bot`: `vercel env pull .env.local` and `pnpm dev` (`vercel dev`).

## Layout

- `apps/bot` — Hono Telegram bot (webhook, Scoring, Standings, Conversations)
- `packages/v1-export` — DynamoDB scan to JSON (no Postgres)
- `apps/web` — frozen Next.js Mini App
- `docs/adr/` — live decisions; Mini App docs live under `docs/archive/nextjs-v2/`

Branch policy: all v2 work on `v2`. Do not commit to `master` (live v1 until
cutover).

## Go-live

Everything you need to run the Hono bot in a real Telegram chat. Work through
the steps in order.

v1 (`master`, AWS Lambda) stays live until a separate cutover. This bot is a
**new BotFather bot** on Vercel. Do not point both bots at the same webhook URL.

Before publishing `v2`, run `pnpm fmt:check`, `pnpm lint`, `pnpm typecheck`,
`pnpm build`, and `pnpm test` from the repository root. All five commands must
pass on the exact commit deployed to Vercel.

### 1. Vercel project and Vercel-managed Neon Postgres

Use the **Vercel-Managed** Neon integration (Marketplace → **Neon Postgres** →
**Create New Neon Account**). Do **not** use the Neon-Managed path unless you
explicitly want Neon billing and a linked Neon project.

**Dashboard**

1. [Vercel](https://vercel.com/) → **Add New Project** → import this repo.
2. **Production branch:** `v2`.
3. **Root Directory:** `apps/bot`. Include files outside the root directory so
   pnpm workspaces resolve. Vercel detects Hono from `src/index.ts` (default
   export of the app). Fluid compute is the Hono default.
4. **Function region:** Frankfurt (`fra1`) in **Settings → Functions**, matching
   the Neon region. There is no `vercel.json`.
5. [Neon on Vercel Marketplace](https://vercel.com/marketplace/neon) →
   **Install** → choose **Create New Neon Account** → pick region/plan → name
   the database.
6. **Storage** → your database → **Connect Project** → select this Vercel
   project → enable **Production** (and **Preview** only if you want isolated
   preview DB branches).
7. Vercel injects connection env vars automatically. Add bot secrets in
   step 4.

| Variable (injected by integration) | Purpose                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| `DATABASE_URL`                     | **Pooled** TCP string — used by the deployed app (`pg` `Pool` + `attachDatabasePool`) |
| `DATABASE_URL_UNPOOLED`            | **Direct** TCP string — use for migrations, `psql`, and the import load               |

Do not paste a Neon console connection string manually unless you are
debugging. Do not use `@neondatabase/serverless` HTTP for production.

Pull env vars locally for migrations and import:

```bash
cd apps/bot
vercel env pull .env.local
```

Run migration, load, and webhook scripts from `apps/bot`. Their dotenv
configuration reads `.env.local` first and `.env` second from that workspace.
The DynamoDB scan (`pnpm v1-export`) runs from the repository root.

### 2. Apply database migrations

This repo uses Drizzle [**Option 3**](https://orm.drizzle.team/docs/migrations):
TypeScript schema → generated SQL in `apps/bot/drizzle/` →
`drizzle-kit migrate` applies pending files.

| Context                  | Drizzle pattern                               | Command                         |
| ------------------------ | --------------------------------------------- | ------------------------------- |
| **Production / Neon**    | Option 3 — `generate` + `drizzle-kit migrate` | `pnpm db:migrate` (below)       |
| **Local tests (PGlite)** | Option 4 — same SQL files, runtime migrator   | automatic in `createPgliteDb()` |

After schema changes, work from `apps/bot`: `pnpm db:generate` → commit new
files under `apps/bot/drizzle/` → run `pnpm db:migrate` against each
environment.

Apply to **production** once from `apps/bot` after `vercel env pull .env.local`.
`drizzle.config.ts` uses `DATABASE_URL_UNPOOLED` when present:

```bash
cd apps/bot
vercel env pull .env.local
pnpm db:migrate
```

Tables: `members`, `messages`, `marks`, `conversations`, `conversation_turns`,
`processed_updates`. This is a fresh schema — do not share the Mini App
database or its migrations.

### 3. BotFather — new bot

1. Message `@BotFather` → `/newbot` → create the v2 bot. Save the token as
   `BOT_TOKEN`.
2. `/setprivacy` → select the bot → **Disable** (privacy mode off so the bot
   receives every group message: Scoring replies, `/stats`, and Conversation
   Turns).
3. Generate a webhook secret: 1–256 characters, only `A-Z`, `a-z`, `0-9`, `_`,
   `-`. Save as `BOT_WEBHOOK_SECRET`. Use the **same** value for Telegram
   `setWebhook` and Vercel.

Record the bot `@username` for later.

### 4. Bot env vars and deploy

In the Vercel project → **Settings → Environment Variables**, add (server-side
only):

| Variable             | Required | Purpose                                                       |
| -------------------- | -------- | ------------------------------------------------------------- |
| `BOT_TOKEN`          | yes      | From BotFather (`/newbot`)                                    |
| `BOT_WEBHOOK_SECRET` | yes      | Same value for `setWebhook.secret_token` and the Hono webhook |
| `AI_GATEWAY_API_KEY` | yes      | Vercel AI Gateway key for Conversation `generateText`         |

`DATABASE_URL` should already exist from step 1. Do not replace it with a
hand-copied URL.

`WEBHOOK_URL` is **not** a Vercel variable — only for the local `set-webhook`
script in step 6.

Deploy (or redeploy after adding env vars). Note the production HTTPS origin,
e.g. `https://your-project.vercel.app`.

### 5. Import v1 history

Scan DynamoDB into JSON from the **repo root**, then load that JSON into
Postgres from `apps/bot`. The scan package does not know Postgres. The bot
does not know DynamoDB. The file `tmp/v1-rows.json` is the only hand-off.

```bash
# 1. DynamoDB -> JSON (the only step needing AWS credentials)
AWS_REGION="eu-west-1" \
AWS_ACCESS_KEY_ID="..." \
AWS_SECRET_ACCESS_KEY="..." \
pnpm v1-export            # writes tmp/v1-rows.json at the repo root

# 2. JSON -> members, messages, marks
cd apps/bot
pnpm import:load
```

| Variable                | Step | Purpose                                                   |
| ----------------------- | ---- | --------------------------------------------------------- |
| `AWS_REGION`            | scan | Region of v1 `lolTable` (e.g. `eu-west-1`)\*              |
| `AWS_ACCESS_KEY_ID`     | scan | IAM key with `dynamodb:Scan` on the table                 |
| `AWS_SECRET_ACCESS_KEY` | scan | Matching secret                                           |
| `LOL_TABLE_NAME`        | scan | Default `lolTable`; CodeStar may suffix (e.g. `-Prod`)    |
| `IMPORT_CHAT_ID`        | scan | Import one chat only (still scans full table)             |
| `IMPORT_JSON`           | both | Path of the JSON dump (default `<repo>/tmp/v1-rows.json`) |
| `DATABASE_URL`          | load | From `.env.local` (`DATABASE_URL_UNPOOLED` preferred)     |

\* `AWS_DEFAULT_REGION` works instead of `AWS_REGION`.

Do **not** add AWS keys to Vercel. Create a short-lived IAM user, import, then
deactivate the access key.

**Where to find AWS values**

- **DynamoDB table:** AWS Console → DynamoDB → Tables → v1 Marks table →
  **Overview** → Region = `AWS_REGION`, table name = `LOL_TABLE_NAME` if not
  `lolTable`.
- **Credentials:** IAM → Users → dedicated import user → policy with
  `dynamodb:Scan` + `dynamodb:DescribeTable` on the table ARN (see
  `docs/archive/nextjs-v2/research/03-read-v1-dynamodb.md`).
- **`IMPORT_CHAT_ID`:** Telegram chat id (negative for groups, often `-100…`)
  from v1 context or DynamoDB `chatId`.

Earliest Mark per slot wins. Latest username in the file wins on `members`.
A v1 Message's post time is the earliest Imported Mark on it (Telegram-second
truncation). Re-running the load is safe (`ON CONFLICT DO NOTHING`).

### 6. Register the Telegram webhook

After Vercel deployment is live, from `apps/bot`:

```bash
BOT_TOKEN="..." \
BOT_WEBHOOK_SECRET="..." \
WEBHOOK_URL="https://your-project.vercel.app/api/telegram" \
pnpm set-webhook
```

The script publishes `/stats`, sets `secret_token` and `allowed_updates`
(`message`, `channel_post`), then verifies via `getWebhookInfo`. Re-run safely
after URL or secret changes.

### 7. Each target Telegram chat

Repeat for every chat that should use v2. Scoring, Standings, and Conversations
work in groups, private chats, and channels — chat type is not a gate.

1. **Add the bot** to the chat.
2. **In a group, promote to administrator with _Delete messages_** so the bot
   can replace an accepted `+` / `-` / `лол` reply with its acknowledgement.
3. Confirm privacy mode is **off** (step 3).
4. **Mark `/stats` ephemeral** in @BotFather so the command stays invisible to
   the rest of a group. `set-webhook` publishes it with `is_ephemeral` for the
   group scope.
5. **Scoring:** reply `+`, `-`, or `лол` (any case, surrounding spaces ok) on
   someone else's message. An accepted reply is deleted and the bot answers
   under the marked message with `➕ (name)`, `➖ (name)`, or `лол (name)` —
   the name is the username on that reply, or `???`, and is not an `@` mention.
6. **Standings:** `/stats` prints all-time ranking in the chat and deletes the
   command. In a chat with no Marks it does nothing and the command stays.
7. **Conversation:** say `бот` (exact, case-sensitive) to open a Conversation.
   Later text in that chat is a Turn until `довольно` (exact, whole message)
   closes it in silence.

There is no Mini App, `/register`, Scoring reactions, Undo, or Seasons.

### 8. Verify

| Check        | How                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| Webhook      | `set-webhook` printed success; or Telegram `getWebhookInfo` shows your URL and `message` in `allowed_updates` |
| Scoring      | Reply `+` to someone else's message — token disappears, `➕ (username)` appears under the marked message      |
| Standings    | `/stats` in a chat with Marks prints five sections; empty chat leaves `/stats` untouched                      |
| Conversation | `бот` gets a short model reply; `довольно` gets none                                                          |
| v1 history   | If imported, `/stats` includes Imported Marks                                                                 |

**Common failures**

- Scoring replies left in the chat → bot cannot delete messages (not admin, or
  missing delete permission), or the slot was already spent.
- Webhook 401 → `BOT_WEBHOOK_SECRET` mismatch between Vercel and `set-webhook`.
- Conversation silence on Wake → `AI_GATEWAY_API_KEY` missing or the model
  call failed (failure is silent by design).
- DB errors on Vercel → Neon integration not connected to the project, or
  `DATABASE_URL` was overwritten manually (should be the pooled URL from the
  integration).

### Not covered here

- **v1 → v2 cutover** (retire AWS bot, update `master`) — deferred until v2 is
  proven in production.
- **Drizzle schema changes** — `pnpm --filter @mike-bot/bot db:generate`,
  commit SQL under `apps/bot/drizzle/`, then `db:migrate` with
  `DATABASE_URL_UNPOOLED` like step 2.
- **Thawing the Mini App** — `apps/web` stays unused.
- **Neon-Managed integration** (link an existing Neon account) — only if you
  want Neon billing; this guide assumes Vercel-managed.
