# Wayfinder: v2 operational on Vercel

## Destination

v2 is live on Vercel: a new Grammy bot in the same group scores messages via three Scoring reactions (Karma plus, Karma minus, Humor) with undo-on-remove; a Next.js Mini App shows honest Seasonal leaderboards with Current Season marked, including v1 DynamoDB history. Polly, Dialogflow, and `/stats` are gone. `master` stays v1 until cutover.

## Notes

- Domain: `CONTEXT.md`. Decisions: `docs/adr/0001-vercel-grammy-next.md` through `docs/adr/0004-event-storage.md`.
- Branch policy: commit on `v2` only. No PRs. Do not touch `master`.
- Stack: Grammy + Next.js on Vercel. [redesigned-giggle](https://github.com/optimistiks/redesigned-giggle) is a kitchen sink for webhook / `message_reaction` / Mini App initData patterns — not the deploy stack (it is TanStack Start + Kamal).
- Telegram: the bot must be a group **admin** and webhook `allowed_updates` must include `message_reaction`. Use full old-vs-new reaction lists so remove can undo; Grammy `bot.reaction()` does not fire on remove.
- Plan, don't build, until this map has no open tickets.
- Skills: grilling + domain-modeling on HITL tickets; research on AFK research tickets; prototype only for Mini App look-and-feel.

## Decisions so far

- Destination and scoring rules — grilled 2026-08-18: same group, new bot; silent chat; mutually exclusive Karma plus/minus with switch-by-undo; Humor independent; Season = calendar month; Current Season highlighted in the Mini App.
- [How does Grammy receive reaction Marks on Vercel?](issues/01-grammy-vercel-webhook.md) — Next.js `webhookCallback` + `std/http`, explicit `message_reaction` in `allowed_updates`, secret token; see `docs/research/01-grammy-vercel-webhook.md`.
- [How does a Next.js Mini App authenticate on Vercel?](issues/02-mini-app-auth-next.md) — `Authorization: tma` + `@tma.js/init-data-node` on Route Handlers; see `docs/research/02-mini-app-auth-next.md`.
- [How do we read v1 DynamoDB Marks?](issues/03-read-v1-dynamodb.md) — one-shot Scan import to Postgres, not live Vercel reads; see `docs/research/03-read-v1-dynamodb.md`.
- [What does a reaction add vs remove look like?](issues/04-reaction-add-remove.md) — old/new diff, message author cache, `bot.on('message_reaction')`; append undo event types (ADR-0004), never delete.
- [Which three emojis are the Scoring reactions?](issues/05-which-emojis.md) — 👍 Karma plus, 👎 Karma minus, 🤣 Humor; standard emoji only.
- [How does the Mini App open?](issues/06-how-mini-app-opens.md) — Bot Menu Button only; no `/app` command.
- [Where do v2 Marks live?](issues/07-where-marks-live.md) — Neon Postgres: `events` (typed strings, no value column), `legacy_marks`, `chat_members`; see ADR-0004.
- [How does v1 history get into the Mini App?](issues/08-v1-history-path.md) — one-shot DynamoDB import as-is into `legacy_marks`; Mini App merges both tables per `chatId`.
- [Which chats and which language?](issues/09-chats-and-language.md) — multi-chat via `chatId`; Russian UI labels.
- [What timezone closes a Season?](issues/10-season-timezone.md) — `Europe/Moscow`.
- [Which leaderboards does the Mini App show?](issues/11-which-leaderboards.md) — all five v1 sections, Current Season default, crown/chicken flair, no decay.
- [How do we display usernames that changed?](issues/15-username-display.md) — `chat_members` table per (`chatId`, `userId`), updated on v2 Marks, seeded from legacy import.
- [What is the v1 → v2 cutover runbook?](issues/16-cutover-runbook.md) — out of scope; decide at cutover.

## Not yet specified

_(empty — open work is tickets 12, 13, 14 only)_

## Out of scope

- Dialogflow NLU
- Amazon Polly / `/s` TTS
- v1 `/stats` command and Humor decay
- Staying on AWS Lambda / CodeStar for v2
- Copying redesigned-giggle's Kamal/TanStack production stack
- v1 → v2 cutover runbook (webhook teardown, bot swap, `master` merge) — decide when v2 is live, not during planning
