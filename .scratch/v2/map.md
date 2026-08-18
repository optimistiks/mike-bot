# Wayfinder: v2 operational on Vercel

## Destination

v2 is live on Vercel: a new Grammy bot scores group messages via three Scoring reactions (👍 👎 🤣) with undo-on-remove; a Next.js Mini App shows honest Seasonal leaderboards (Current Season marked), including v1 DynamoDB history. Multi-chat via `chat_id`. Polly, Dialogflow, and `/stats` are gone. `master` stays v1 until cutover.

## Notes

- Domain: `CONTEXT.md`. ADRs: `docs/adr/0001` through `docs/adr/0005`.
- Research: `docs/research/01`–`04`.
- Branch policy: commit on `v2` only. No PRs. Do not touch `master`.
- Stack: Grammy + Next.js on Vercel. [redesigned-giggle](https://github.com/optimistiks/redesigned-giggle) = pattern reference only (webhook, reactions, initData) — not deploy stack.
- Telegram bot: group **admin** required; **privacy mode off**; `allowed_updates` must include at least `message`, `message_reaction`, `my_chat_member`, `chat_member`.
- Reactions: use `bot.on('message_reaction')` + old/new diff — not `bot.reaction()` alone (no remove). `MessageReactionUpdated.user` = actor; message author = `subject_id` from `message_authors` cache. Bot API has no `getMessage`.
- Events: append-only typed strings (`karma.plus`, `karma.undo.plus`, …) — no `value` column; scoring weights in application code (ADR-0004).
- Postgres (Neon): `events`, `legacy_marks`, `chat_members`, `chat_memberships`, `message_authors`, `processed_updates` (ADR-0004, ADR-0005).
- Mini App: Menu Button only → initData auth → chat picker from `chat_memberships` → leaderboard for chosen `chat_id`. Russian UI labels; `Europe/Moscow` seasons.
- Plan, don't build, until open tickets are resolved.

## Decisions so far

- **Destination & scoring** — grilled 2026-08-18: silent chat; Karma ± mutually exclusive with switch-by-undo; Humor independent; no self/bots; Seasons = calendar month; Current Season in UI.
- [01 Grammy on Vercel](issues/01-grammy-vercel-webhook.md) — `webhookCallback` + `std/http`, `message_reaction` in `allowed_updates`, secret token → `docs/research/01-grammy-vercel-webhook.md`.
- [02 Mini App auth](issues/02-mini-app-auth-next.md) — `Authorization: tma` + `@tma.js/init-data-node` → `docs/research/02-mini-app-auth-next.md`.
- [03 Read v1 DynamoDB](issues/03-read-v1-dynamodb.md) — one-shot Scan, not live Vercel reads → `docs/research/03-read-v1-dynamodb.md`.
- [04 Reaction add/remove](issues/04-reaction-add-remove.md) — old/new diff; `message_authors` for `subject_id`; append undo event types → `docs/research/04-reaction-add-remove.md`.
- [05 Emojis](issues/05-which-emojis.md) — 👍 👎 🤣 standard emoji only.
- [06 Mini App entry](issues/06-how-mini-app-opens.md) — Bot Menu Button only.
- [07 Storage](issues/07-where-marks-live.md) — Neon: `events`, `legacy_marks`, `chat_members`, `chat_memberships`, `message_authors` (ADR-0004, ADR-0005).
- [08 v1 history](issues/08-v1-history-path.md) — `legacy_marks` import as-is; merge on read in Mini App.
- [09 Chats & language](issues/09-chats-and-language.md) — multi-chat; Russian UI.
- [10 Timezone](issues/10-season-timezone.md) — `Europe/Moscow`.
- [11 Leaderboards](issues/11-which-leaderboards.md) — five v1 sections; Current Season default; crown/chicken; no decay.
- [15 Usernames](issues/15-username-display.md) — `chat_members` for display names; seeded from legacy import.
- [16 Cutover](issues/16-cutover-runbook.md) — out of scope until v2 is live.
- **Event types** (ADR-0004) — `karma.plus` / `karma.undo.plus` / `karma.minus` / `karma.undo.minus` / `humor.add` / `humor.undo.add`; never delete rows.
- **Message cache** (ADR-0005) — `message_authors`: `author_id`, `author_is_bot`, `message_date` only; no text/media; skip score if uncached.
- **Chat picker** (ADR-0005) — `chat_memberships` synced on join/leave; Mini App lists user's chats with bot.
- **Webhook dedup** (ADR-0005) — ignore duplicate `update_id` before appending events.

## Not yet specified

- **Legacy read mapping** — how `legacy_marks.lolType` (`plus`/`minus`/`lol`) joins v2 event types in the five RU leaderboard sections
- **Scoring module** — shared application map of event type → leaderboard bucket (received karma, humor given, etc.)
- **Repo layout** — one Next.js app (webhook + Mini App) vs split packages
- **Empty / edge states** — Mini App with no shared chats; reaction on uncached message (skip silently vs log)

## Open tickets

| # | Ticket | Type | Owner |
| --- | --- | --- | --- |
| 12 | [Mini App look](issues/12-mini-app-look.md) | prototype | agent |
| 13 | [Bot admin in group](issues/13-bot-admin-in-group.md) | task | human |
| 14 | [Vercel + BotFather secrets](issues/14-vercel-botfather-secrets.md) | task | human (after build) |

## Out of scope

- Dialogflow, Polly, `/stats`, Humor decay
- AWS Lambda / CodeStar for v2
- redesigned-giggle Kamal/TanStack stack
- v1 → v2 cutover runbook
