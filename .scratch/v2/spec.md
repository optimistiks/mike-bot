Status: ready-for-agent

# v2: Telegram scoring bot on Vercel

Synthesized from the cleared [v2 operational on Vercel](map.md) wayfinder map (21 resolved tickets, ADRs 0001–0005, `CONTEXT.md`).

## Problem Statement

Mike-bot v1 runs on AWS Lambda with reply-text Marks (`+`, `-`, `лол`), in-chat confirmations, a `/stats` command with Humor decay, and DynamoDB storage. The group wants a modern replacement that scores messages via Telegram reactions, stays silent in the chat, shows honest seasonal leaderboards in a Mini App (including historical v1 data), supports multiple groups, and deploys on Vercel — without carrying forward Dialogflow, Polly, `/stats`, or the old AWS hosting model.

## Solution

Build v2 as a Turborepo monorepo on the `v2` branch: a Grammy bot webhook and Next.js Mini App deployed together on Vercel, backed by Neon Postgres (PGlite locally). Members Mark each other's messages with three Scoring reactions (👍 Karma plus, 👎 Karma minus, 🤣 Humor); removing a reaction appends an undo Event. The bot writes append-only Events, caches message authors and chat rosters, and never speaks in the group. The Mini App opens from the Bot Menu Button, lets the opener pick a Chat from their memberships, and shows five Russian leaderboard sections filtered by Season (calendar month in `Europe/Moscow`), with Current Season highlighted. v1 DynamoDB history is one-shot imported into the same `events` table before go-live.

## User Stories

### Scoring in the group

1. As a Member, I want to add 👍 to someone's message, so that they receive Karma plus.
2. As a Member, I want to add 👎 to someone's message, so that they receive Karma minus.
3. As a Member, I want to add 🤣 to someone's message, so that they receive Humor.
4. As a Member, I want to remove a Scoring reaction I previously added, so that the Mark is undone without deleting history.
5. As a Member, I want the bot to stay silent when I Mark or undo a Mark, so that the group chat is not cluttered with confirmations.
6. As a Member, I want to switch from 👍 to 👎 on the same message (or the reverse), so that Karma plus and Karma minus stay mutually exclusive.
7. As a Member, I want to hold 👍 or 👎 together with 🤣 on the same message, so that Humor stays independent of Karma.
8. As a Member, I want the bot to ignore my reaction if I Mark my own message, so that self-Marking is impossible.
9. As a Member, I want the bot to ignore reactions on bot messages, so that bots cannot be scored.
10. As a Member, I want Marks on messages the bot never saw to be skipped quietly, so that partial cache gaps do not break the webhook.
11. As a group admin, I want to add the bot as an administrator with privacy mode off, so that the bot receives `message` and `message_reaction` updates.
12. As a Member, I want duplicate Telegram updates to be ignored, so that retries do not double-count Marks.

### Mini App access and navigation

13. As a Member, I want to open the Mini App from the bot's Menu Button, so that I do not need a `/stats` command or inline keyboard.
14. As a Member opening the Mini App, I want to see a list of Chats where I am a member and the bot is present, so that I can pick which group's leaderboards to view.
15. As a Member with no shared Chats with the bot, I want a Russian empty state («Нет общих чатов с ботом» plus a hint to add the bot to a group), so that I understand why the picker is empty.
16. As a Member, I want the Mini App UI in Russian, so that it matches the tone of v1 `/stats`.
17. As a Member, I want to view leaderboards scoped to the Chat I selected, so that scores from other groups do not mix in.

### Leaderboards and Seasons

18. As a Member, I want to see «Уважаемые люди» (net Karma received), so that I know who is most respected in the group.
19. As a Member, I want to see «Юмористы» (Humor received, no decay), so that I know who makes people laugh.
20. As a Member, I want to see «Поставили +» (Karma plus given), so that I know who hands out the most praise.
21. As a Member, I want to see «Поставили −» (Karma minus given), so that I know who hands out the most criticism.
22. As a Member, I want to see «Поставили лол» (Humor given), so that I know who spreads the most humor reactions.
23. As a Member, I want Current Season to be the default view and clearly marked, so that I see what is happening now.
24. As a Member, I want to drill down by calendar year and month, so that I can compare past Seasons.
25. As a Member, I want Season boundaries in `Europe/Moscow`, so that everyone agrees when a month closes regardless of local timezone.
26. As a Member, I want 👑 on the #1 entry in each section, so that the top spot is obvious.
27. As a Member, I want 🐔 on the last-place entry in each section, so that the v1 `/stats` tone is preserved.
28. As a Member, I want honest counts with no Humor decay, so that leaderboard numbers reflect actual Marks.
29. As a Member, I want display names joined from the latest known username for each Member in the Chat, so that renames do not break readability.
30. As a Member, I want v1 history included in the same leaderboards as live v2 Marks, so that long-running group history is not lost.

### Multi-chat and membership

31. As a bot operator, I want the bot to serve many Chats keyed by `chat_id`, so that the same deployment works for multiple groups.
32. As a Member who joins a group with the bot, I want my Chat membership recorded, so that the Mini App picker includes that Chat.
33. As a Member who leaves a group, I want my Chat membership updated, so that I no longer see that Chat in the picker.
34. As the bot, I want to cache each message's author when I receive a `message` update, so that I can resolve the Subject on reaction events.

### Data integrity and history

35. As a bot operator, I want every Mark change to append one Event with a typed string (never update or delete rows), so that the log is auditable and undo-safe.
36. As a bot operator, I want scoring weights defined in application code rather than a database `value` column, so that new Event types can be added without schema migrations.
37. As a bot operator, I want to run a one-shot v1 DynamoDB import locally, so that v1 rows become Events with `legacy_id` and import is idempotent on re-run.
38. As a bot operator, I want the import to seed `chat_members` from v1 actors and subjects, so that Members who only appear in v1 history still have display names.
39. As a bot operator, I want imported Events to keep v1 `created_at` timestamps bucketed in `Europe/Moscow`, so that Season views include accurate historical placement.

### Development and deployment

40. As a developer, I want to run and test locally with PGlite without bot admin rights, AWS keys, or Vercel secrets, so that I can iterate on scoring and UI quickly.
41. As a developer, I want a script to register the Telegram webhook with `secret_token` and the correct `allowed_updates`, so that production receives reactions and membership changes.
42. As a developer, I want v1 `src/` to remain in the repo but unwired from the v2 build, so that cutover can happen later without blocking v2 development.
43. As a deployer, I want server-side-only env vars (`BOT_TOKEN`, `BOT_WEBHOOK_SECRET`, `DATABASE_URL`), so that secrets are not exposed to the Mini App client.
44. As a deployer, I want BotFather's Menu Button pointed at the production Vercel HTTPS origin, so that Members can open the Mini App.

### Explicit non-goals (for clarity in stories)

45. As a Member, I do not want `/stats` in the chat, so that stats live only in the Mini App.
46. As a Member, I do not want in-chat emoji confirmations on Marks, so that the group stays quiet.
47. As a bot operator, I do not want live DynamoDB reads from Vercel, so that v1 AWS infra is off the hot path after import.

## Implementation Decisions

### Repository and hosting

- **Turborepo monorepo** at the repo root with a Next.js App Router app as the Vercel deploy target. v1 Telegraf code under the existing `src/` tree stays present but is not part of the v2 build graph until cutover.
- **Vercel** hosts both the Grammy webhook Route Handler and the Mini App. Do not port redesigned-giggle's TanStack Start / Kamal / VPS stack; use it only as a pattern reference.
- **Branch policy:** all v2 implementation commits on `v2`; do not modify `master` until an explicit cutover effort (out of scope here).
- **Runtime:** Next.js Node default; webhook handler should stay fast (Grammy default ~10s timeout; Telegram retries non-2xx).

### Telegram bot (Grammy)

- **Webhook:** POST Route Handler using `webhookCallback` with `std/http` adapter and `secretToken` matching `BOT_WEBHOOK_SECRET`.
- **`allowed_updates`:** must include at least `message`, `message_reaction`, `my_chat_member`, `chat_member`. Reactions are opt-in and excluded by default.
- **Bot requirements in each group:** administrator; privacy mode off.
- **Scoring reactions:** standard emoji only — 👍 = Karma plus, 👎 = Karma minus, 🤣 = Humor.
- **Reaction handler:** subscribe with `bot.on('message_reaction')`; diff `old_reaction` vs `new_reaction` to detect add vs remove. Do not rely on `bot.reaction()` alone (add-only, no undo path).
- **Actor vs Subject:** `MessageReactionUpdated.user` is the Actor (`actor_id`). Subject (`subject_id`) comes from the `message_authors` cache keyed by (`chat_id`, `message_id`). If no cache row exists, skip scoring silently and `console.log` identifiers — no backfill (Bot API has no `getMessage`).
- **Business rules enforced in the bot adapter:**
  - No self-Marking (Actor equals Subject).
  - No Marking bots (`author_is_bot` from cache).
  - Karma plus and Karma minus mutually exclusive per Member per message (app-enforced; Telegram allows multiple reactions).
  - Humor independent of Karma polarity.
- **Message handler:** on each `message` update, upsert `message_authors` with `author_id`, `author_is_bot`, `message_date` only — never store text, media, or captions.
- **Membership sync:** on `my_chat_member` and `chat_member`, maintain `chat_memberships` for the Mini App chat picker; seed member lists from administrators where practical on bot join.
- **Display names:** upsert `chat_members` when processing live Events (Actor and Subject).
- **Idempotency:** record processed Telegram `update_id` in `processed_updates` before appending Events; ignore duplicates.
- **Silence:** never send confirmation messages in the group for Marks or undos.

### Event storage (Postgres)

Append-only **`events`** table — rows are never updated or deleted.

| Column | Role |
| --- | --- |
| `type` | Closed vocabulary of Event type strings |
| `chat_id` | Chat scope |
| `actor_id` | Member who reacted |
| `subject_id` | Member who wrote the message |
| `message_id` | Telegram message id |
| `created_at` | Timestamp for Season bucketing (reaction time for live Events; preserved v1 time on import) |
| `legacy_id` | Optional UNIQUE v1 DynamoDB UUID for idempotent import; NULL for live v2 Events |

**Event type vocabulary:**

| Telegram action | Event `type` |
| --- | --- |
| Add 👍 | `karma.plus` |
| Remove 👍 | `karma.undo.plus` |
| Add 👎 | `karma.minus` |
| Remove 👎 | `karma.undo.minus` |
| Add 🤣 | `humor.add` |
| Remove 🤣 | `humor.undo.add` |

Supporting tables:

- **`chat_members`:** (`chat_id`, `user_id`) → latest display name (`@username` or first name).
- **`chat_memberships`:** (`chat_id`, `user_id`) roster for Mini App picker; synced on join/leave.
- **`message_authors`:** (`chat_id`, `message_id`) → `author_id`, `author_is_bot`, `message_date`.
- **`processed_updates`:** `update_id` for webhook dedup.

**Local dev:** PGlite stands in for Neon Postgres so builds and tests run without cloud credentials.

### Scoring module

Single shared module imported by both the webhook handler (type constants only when writing) and the leaderboard API (full read-side math). No duplication, no code generation.

**Bot writes Event types only** — it does not run aggregation.

**Read-side responsibilities:**

- Event type constants.
- `eventTypeToContributions(type)` — maps each Event type to leaderboard bucket deltas.
- `aggregateLeaderboard(events, season)` — produces five ranked sections for a Chat and Season filter.
- Season bucketing in `Europe/Moscow`; Current Season = today's year-month in that timezone.

**Bucket matrix** (undo types invert the add):

| Event type | Karma received (subject) | Humor received (subject) | Karma+ given (actor) | Karma− given (actor) | Humor given (actor) |
| --- | --- | --- | --- | --- | --- |
| `karma.plus` | +1 | — | +1 | — | — |
| `karma.undo.plus` | −1 | — | −1 | — | — |
| `karma.minus` | −1 | — | — | +1 | — |
| `karma.undo.minus` | +1 | — | — | −1 | — |
| `humor.add` | — | +1 | — | — | +1 |
| `humor.undo.add` | — | −1 | — | — | −1 |

**Karma received** («Уважаемые люди») is **net** Karma for the Subject (plus and minus Events combined).

**Five leaderboard sections** (Russian labels):

1. Уважаемые люди — net Karma received
2. Юмористы — Humor received (no decay)
3. Поставили + — Karma plus given
4. Поставили − — Karma minus given
5. Поставили лол — Humor given

Rankings include Crown on #1 and Chicken on last in each section.

### Mini App and API

- **Entry:** Bot Menu Button only (BotFather → production Vercel HTTPS URL). No `/app` command or inline keyboard entry point.
- **Authentication (toy scope):** parse `user.id` from Telegram initData naively — **no HMAC validation**. Client passes initData on API calls; harden later if needed.
- **Flow:** Mini App home → chat picker from `chat_memberships` for opener's `user_id` → season selector (default Current Season; year/month drill-down) → five leaderboard sections for chosen `chat_id`.
- **Leaderboard API:** thin Route Handler — query `events` for `chat_id` + season, run `aggregateLeaderboard`, join `chat_members` for display names, return ranked lists with crown/chicken metadata.
- **Empty picker:** show Russian empty state; do not throw or retry loop.
- **UI language:** Russian for all user-visible Mini App copy; domain glossary in `CONTEXT.md` stays English for engineering.

### v1 import

- **One-shot local script** scans DynamoDB `lolTable` with temporary AWS credentials — not Vercel runtime, not live reads.
- **No separate legacy table.** Each v1 row converts to one Event:

| v1 `lolType` | v2 Event `type` |
| --- | --- |
| `plus` | `karma.plus` |
| `minus` | `karma.minus` |
| `lol` | `humor.add` |

- Field mapping: `fromUser.id` → `actor_id`, `toUser.id` → `subject_id`, `chatId` → `chat_id`, `toMessageId` → `message_id`, v1 `id` → `legacy_id`, `createdAt` → `created_at`.
- v1 had no undos — every imported row is an add-type Event.
- Idempotency: `ON CONFLICT (legacy_id) DO NOTHING`.
- Same script upserts `chat_members` from v1 `fromUser` / `toUser`.
- **Webhook registration script** sets `secret_token`, `allowed_updates`, and verifies via `getWebhookInfo`.

### Module boundaries

| Module | Responsibility |
| --- | --- |
| Bot adapter | Telegram shapes → Event types; membership and message cache sync; business rule enforcement |
| Scoring | Event types → bucket contributions → aggregated leaderboard sections |
| Database layer | Migrations, queries, PGlite/Neon connection |
| Leaderboard API | Query + aggregate + join display names |
| Mini App UI | Chat picker, season navigation, render five sections |
| Import script | DynamoDB Scan → Events + chat_members seed |
| Webhook setup script | `setWebhook` with correct options |

## Testing Decisions

### Primary test seam

**`lib/scoring/`** is the primary (and ideally sole) unit-test seam. It is the highest layer that captures the core business behavior — Season bucketing, bucket matrix, net Karma, five sections, crown/chicken ordering — without Telegram or database I/O.

Tests feed arrays of Event-shaped records (type, actor_id, subject_id, created_at) and assert the external behavior of aggregated leaderboard output: section names, ranked Member ids, scores, and crown/chicken flags. Do not assert internal helper names or private matrix structure unless a regression specifically warrants it.

### Secondary seams (integration, fewer tests)

- **Bot adapter → Event type mapping:** table-driven tests from synthetic old/new reaction diffs to expected Event types and skip conditions (self, bot, uncached message). Keep these focused on mapping and rules, not Postgres.
- **Webhook Route Handler:** one or two end-to-end tests with PGlite — synthetic Telegram update payload in, expected rows in `events` / `processed_updates` out.
- **Leaderboard API:** smoke test that query + scoring + `chat_members` join returns the five sections for a seeded fixture.

### What makes a good test here

- Test **observable outcomes** (rankings, scores, skipped Marks, deduped updates), not implementation details (SQL shape, internal function call order).
- Prefer deterministic timestamps with explicit `Europe/Moscow` Season boundaries in fixtures.
- Use PGlite for database integration tests so CI and local dev need no Neon or AWS.

### Prior art

v1 has only a single Mocha test on the Lambda handler empty-body case (`tests/test.ts`). v2 establishes the scoring module tests as the new baseline; no need to extend v1 Telegraf tests.

## Out of Scope

- **v1 → v2 cutover runbook** — deferred until v2 is live on Vercel.
- **Mini App visual design prototype** — build minimal functional UI; polish in production.
- **Dialogflow, Amazon Polly, `/stats` command** — dropped with v1 behavior.
- **Humor decay** — v2 leaderboards are honest counts only.
- **AWS Lambda / CodeStar hosting for v2** — Vercel only.
- **redesigned-giggle stack copy** (TanStack Start, Kamal, Docker/VPS).
- **initData HMAC validation** — toy scope uses naive parse; security hardening is a future effort.
- **Production hardening** beyond toy grade (structured logging, rate limits, monitoring dashboards).
- **Live DynamoDB reads from Vercel** — history via one-shot import only.
- **Message backfill** when `message_authors` is missing.
- **Changes to `master` / v1 runtime** during this build.

## Further Notes

### Human deploy checklist (non-blocking for development)

1. Add the new BotFather bot to each target group; promote to **administrator**; privacy mode **off**; record `@username`.
2. Deploy the Next.js app from `v2` on Vercel; set `BOT_TOKEN`, `BOT_WEBHOOK_SECRET`, `DATABASE_URL` (server-side only).
3. BotFather Menu Button → production Vercel HTTPS URL; run webhook registration script with `message_reaction` in `allowed_updates`.
4. Run v1 import script locally with temporary AWS creds (one-shot before or after deploy; not on Vercel runtime).

### Reference artifacts

- Domain glossary: `CONTEXT.md`
- Architecture: `docs/adr/0001` through `docs/adr/0005`
- Research: `docs/research/01` through `docs/research/04`
- Wayfinder map and tickets: `.scratch/v2/map.md`, `.scratch/v2/issues/`

### Suggested build order

1. Monorepo scaffold + database migrations + PGlite wiring
2. Scoring module + tests (primary seam)
3. Bot adapter (reactions, cache, membership, dedup)
4. Telegram webhook Route Handler
5. Leaderboard API Route Handler
6. Mini App page (minimal Russian UI)
7. Import and webhook setup scripts
8. Vercel deploy + human ops checklist
