# Wayfinder: v2 operational on Vercel

## Destination

v2 is live on Vercel: a new Grammy bot scores group messages via three Scoring reactions (👍 👎 🤣) with undo-on-remove; a Next.js Mini App shows honest Seasonal leaderboards (Current Season marked), including v1 DynamoDB history. Multi-chat via `chat_id`. Polly, Dialogflow, and `/stats` are gone. `master` stays v1 until cutover.

## Notes

- Domain: `CONTEXT.md`. ADRs: `docs/adr/0001` through `docs/adr/0005`.
- Research: `docs/research/01`–`04`.
- Branch policy: commit on `v2` only. No PRs. Do not touch `master`.
- Local dev: [PGlite](https://pglite.dev/) — no bot admin, AWS keys, or Vercel secrets required to build and test.
- Stack: **Turborepo monorepo** → `apps/web` Next.js on Vercel. redesigned-giggle = not copied.
- Telegram bot: group **admin** required; **privacy mode off**; `allowed_updates` must include at least `message`, `message_reaction`, `my_chat_member`, `chat_member`.
- Reactions: use `bot.on('message_reaction')` + old/new diff — not `bot.reaction()` alone (no remove). `MessageReactionUpdated.user` = actor; message author = `subject_id` from `message_authors` cache. Bot API has no `getMessage`.
- Events: append-only typed strings (`karma.plus`, `karma.undo.plus`, …) — no `value` column; scoring in `lib/scoring/`.
- Postgres (Neon): `events` (+ `legacy_id` for import), `chat_members`, `chat_memberships`, `message_authors`, `processed_updates`.
- Mini App: Menu Button → parse initData (no HMAC validation) → chat picker from `chat_memberships` → leaderboard for chosen `chat_id`. Russian UI; `Europe/Moscow` seasons.
- **Route clear** — wayfinder tickets resolved; [spec](../spec.md) published; build tickets [22–27](issues/22-monorepo-scaffold-and-postgres-foundation.md) `ready-for-agent`.

## Deploy ops

Human steps before production works in a real group. Non-blocking for development.

1. **Bot in group** — Add the new BotFather bot to the group; promote to **administrator** (required for `message_reaction` updates). Privacy mode **off**. Record bot `@username`.
2. **Vercel project** — Deploy `apps/web` from the `v2` branch. Set env vars (server-side only, never `NEXT_PUBLIC_*`):
   - `BOT_TOKEN`
   - `BOT_WEBHOOK_SECRET` (same value for `setWebhook.secret_token` and `webhookCallback`)
   - `DATABASE_URL` (Neon Postgres)
   - Mini App URL is the Vercel deployment HTTPS origin
3. **BotFather** — Menu Button → production Vercel HTTPS URL. Run `scripts/set-webhook.ts` to register webhook with `message_reaction` in `allowed_updates`.
4. **v1 import** — Run `scripts/import-v1.ts` locally with temporary AWS creds (one-shot; not on Vercel runtime).

## Decisions so far

- **Destination & scoring** — grilled 2026-08-18: silent chat; Karma ± mutually exclusive with switch-by-undo; Humor independent; no self/bots; Seasons = calendar month; Current Season in UI.
- [01 Grammy on Vercel](issues/01-grammy-vercel-webhook.md) — `webhookCallback` + `std/http`, `message_reaction` in `allowed_updates`, secret token → `docs/research/01-grammy-vercel-webhook.md`.
- [02 Mini App auth](issues/02-mini-app-auth-next.md) — parse initData naively (no HMAC); amended from research → `docs/research/02-mini-app-auth-next.md`.
- [03 Read v1 DynamoDB](issues/03-read-v1-dynamodb.md) — one-shot Scan, not live Vercel reads → `docs/research/03-read-v1-dynamodb.md`.
- [04 Reaction add/remove](issues/04-reaction-add-remove.md) — old/new diff; `message_authors` for `subject_id`; append undo event types → `docs/research/04-reaction-add-remove.md`.
- [05 Emojis](issues/05-which-emojis.md) — 👍 👎 🤣 standard emoji only.
- [06 Mini App entry](issues/06-how-mini-app-opens.md) — Bot Menu Button only.
- [07 Storage](issues/07-where-marks-live.md) — Neon: `events`, `chat_members`, `chat_memberships`, `message_authors`, `processed_updates`.
- [08 v1 history](issues/08-v1-history-path.md) — one-shot import into `events`; no `legacy_marks`.
- [09 Chats & language](issues/09-chats-and-language.md) — multi-chat; Russian UI.
- [10 Timezone](issues/10-season-timezone.md) — `Europe/Moscow`.
- [11 Leaderboards](issues/11-which-leaderboards.md) — five v1 sections; Current Season default; crown/chicken; no decay.
- [15 Usernames](issues/15-username-display.md) — `chat_members` for display names; seeded from v1 import.
- [16 Cutover](issues/16-cutover-runbook.md) — out of scope until v2 is live.
- **Event types** (ADR-0004) — `karma.plus` / `karma.undo.plus` / `karma.minus` / `karma.undo.minus` / `humor.add` / `humor.undo.add`; never delete rows.
- **Message cache** (ADR-0005) — `message_authors`: `author_id`, `author_is_bot`, `message_date` only; no text/media; skip score if uncached.
- **Chat picker** (ADR-0005) — `chat_memberships` synced on join/leave; Mini App lists user's chats with bot.
- **Webhook dedup** (ADR-0005) — ignore duplicate `update_id` before appending events.
- [Legacy read mapping](issues/17-legacy-read-mapping.md) — single `events` table; v1 import converts rows to event types; bucket matrix; keep v1 RU “given” labels.
- [Scoring module](issues/18-scoring-module.md) — `lib/scoring/` for read-side math; `lib/bot/` for reaction→type; bot writes types only; thin leaderboard API.
- [24 Reaction marking via webhook](issues/24-reaction-marking-via-webhook.md) — Grammy `webhookCallback` at `/api/telegram`; reaction diff → six Event types; message author cache, dedup, silent skips; PGlite integration test to leaderboard.
- [Repo layout](issues/19-repo-layout.md) — Turborepo monorepo; `apps/web` Next.js App Router; no giggle copy; skip production hardening.
- [Edge states](issues/20-edge-states.md) — empty picker RU message; uncached message skip + console.log; silent in group; no backfill.
- [v1 import into events](issues/21-v1-import-into-events.md) — `legacy_id` idempotency; seed `chat_members` in same script; local one-shot; no `legacy_marks`.

## Not yet specified

_(empty)_

## Out of scope

- [Mini App look](issues/12-mini-app-look.md) — UI prototype skipped; test in production instead
- Dialogflow, Polly, `/stats`, Humor decay
- AWS Lambda / CodeStar for v2
- redesigned-giggle Kamal/TanStack stack
- v1 → v2 cutover runbook
