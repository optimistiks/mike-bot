# Wayfinder: v2 operational on Vercel

## Destination

v2 is live on Vercel: a new Grammy bot scores group messages via three Scoring reactions (👍 👎 🤣) with undo-on-remove; a Next.js Mini App shows honest Seasonal leaderboards (Current Season marked), including v1 DynamoDB history. Multi-chat via `chat_id`. Polly, Dialogflow, and `/stats` are gone. `master` stays v1 until cutover.

## Notes

- The Destination is aspirational. Current progress is represented by resolved decisions and the remaining frontier, not by the Destination wording itself.
- Domain: `CONTEXT.md`. ADRs: `docs/adr/0001` through `docs/adr/0007`.
- Research: `docs/research/01`–`04`.
- Branch policy: commit on `v2` only. No PRs. Do not touch `master`.
- Local development uses PGlite and signed deterministic TMA personas; no bot administration, AWS keys, or Vercel secrets are needed to build and test.
- Stack: Turborepo monorepo with `apps/web` as the Next.js Vercel application.
- Telegram bot: group administrator required; privacy mode off; `allowed_updates` includes `message`, `message_reaction`, and `chat_member`.
- Events are append-only typed strings; scoring lives in application code.
- Postgres has `events`, `chat_members`, `chat_memberships`, `registration_messages`, `message_authors`, and `processed_updates`.
- Mini App: Menu Button → signed TMA identity → registered Chat picker → membership-authorized Seasonal leaderboard.
- Agent implementation and artifact reconciliation are complete through [Reconcile artifacts and finalize the go-live guide](issues/36-artifact-and-go-live-reconciliation.md).

## Remaining human work

The Destination is not reached until [Put v2 live on Vercel and Telegram](issues/37-put-v2-live-on-vercel-and-telegram.md) is completed. The human operator must publish the current `v2` branch, complete the README go-live checklist, configure Vercel/Neon/BotFather/Telegram, import v1 history, and verify the real group flow. The README is the detailed operational checklist; the ticket records completion of that frontier.

## Decisions so far

- [Reconcile artifacts and finalize the go-live guide](issues/36-artifact-and-go-live-reconciliation.md) — canonical artifacts describe the current implementation directly, resolved tickets are explicitly historical, and the remaining deployment gap is a human frontier.
- [Provide faithful signed TMA development personas](issues/35-signed-tma-development-personas.md) — local browsers use `mockTelegramEnv` with a server-signed allowlist of deterministic seed personas; production accepts only `BOT_TOKEN`.
- [Adopt the TMA React SDK in the production Mini App](issues/34-tma-react-sdk.md) — the production client uses one `@tma.js/sdk-react` lifecycle adapter, Telegram theme and viewport variables, raw init-data forwarding, and native leaderboard back navigation.
- [Authenticate TMA Members and authorize Chat access](issues/33-tma-identity-and-chat-authorization.md) — protected APIs validate Telegram-signed init data and require the authenticated Member's Chat membership before exposing leaderboard data.
- [Move fixtures behind deterministic `db:seed`](issues/32-deterministic-database-seed.md) — explicit Drizzle Seed reset populates local PGlite; remote reset requires deliberate opt-in; API reads never seed.
- [Simplify script environment loading and enforce warning-free lint](issues/31-simple-script-env-and-warning-free-lint.md) — operational entry points load workspace environment files directly and lint fails on warnings.
- [How does Grammy receive reaction Marks on Vercel?](issues/01-grammy-vercel-webhook.md) — the Next.js webhook validates Telegram's secret and receives the required update types.
- [How does a Next.js Mini App authenticate on Vercel?](issues/02-mini-app-auth-next.md) — raw init data is forwarded by the client and signature-validated by the server.
- [How do we read v1 DynamoDB Marks?](issues/03-read-v1-dynamodb.md) — v1 history is scanned once by a local import, never read live by Vercel.
- [What does a reaction add vs remove look like?](issues/04-reaction-add-remove.md) — old/new reaction state is diffed; supported additions and removals append matching Event types.
- [Which three emojis are the Scoring reactions?](issues/05-which-emojis.md) — 👍 is Karma plus, 👎 is Karma minus, and 🤣 is Humor; all three are independent standard reactions.
- [How does the Mini App open?](issues/06-how-mini-app-opens.md) — the Bot Menu Button is the sole production entry point.
- [Where do v2 Marks live?](issues/07-where-marks-live.md) — Neon stores append-only Events and the supporting Member, registration, author-cache, and update-deduplication data.
- [How does v1 history get into the Mini App?](issues/08-v1-history-path.md) — v1 rows are converted into the shared `events` table with `legacy_id` idempotency.
- [Which chats and which language?](issues/09-chats-and-language.md) — the bot is multi-Chat and the Mini App UI is Russian.
- [What timezone closes a Season?](issues/10-season-timezone.md) — Seasons use `Europe/Moscow` calendar months.
- [Which leaderboards does the Mini App show?](issues/11-which-leaderboards.md) — five Russian sections show honest Seasonal counts with Crown and Chicken flair.
- [How do we display usernames that changed?](issues/15-username-display.md) — leaderboard identities are keyed by Member id and displayed through `chat_members`.
- [How does v1 DynamoDB import into events?](issues/21-v1-import-into-events.md) — the one-shot import preserves timestamps, converts Event types, and inserts missing display names without overwriting current ones.
- [Where does scoring logic live?](issues/18-scoring-module.md) — read-side scoring is isolated from the Telegram adapter and shared by the leaderboard query path.
- [How is the repo laid out?](issues/19-repo-layout.md) — v2 is a Turborepo monorepo with a Next.js App Router application; v1 runtime source is absent.
- [What happens at the edges?](issues/20-edge-states.md) — uncached-message Marks are skipped silently and unregistered openers receive registration guidance.
- [Monorepo scaffold and Postgres foundation](issues/22-monorepo-scaffold-and-postgres-foundation.md) — the workspace, six-table Drizzle schema, PGlite development path, and Vercel database adapter are present.
- [Leaderboard read path](issues/23-leaderboard-read-path.md) — the API queries one Chat and Season and renders five ranked sections.
- [Reaction Marking via webhook](issues/24-reaction-marking-via-webhook.md) — supported reaction changes append six Event types with author lookup, domain guards, and transactional update deduplication.
- [Mini App navigation](issues/25-mini-app-navigation.md) — the signed, registered Chat picker leads to Current Season and historical leaderboard views.
- [v1 DynamoDB one-shot import](issues/26-v1-dynamodb-one-shot-import.md) — the local import converts v1 rows into Events and supports an inspectable PGlite dry run.
- [Production webhook registration and Vercel deploy](issues/27-production-webhook-and-vercel-deploy.md) — repository-side deployment configuration and webhook tooling are ready; external activation remains human work.
- [How do Members register for Mini App access?](issues/28-explicit-registration-model.md) — an administrator posts a Registration message and any added reaction explicitly registers that Member.
- [Explicit registration](issues/29-explicit-registration-flow.md) — Registration-message reactions populate `chat_memberships`; leaving or being kicked removes membership.
- [Mini App «go register» empty state](issues/30-mini-app-go-register-empty-state.md) — unregistered openers see Russian instructions to react to a Registration message or ask an administrator to run `/register`.

## Not yet specified

_(empty)_

## Out of scope

- [What does the Mini App look like?](issues/12-mini-app-look.md) — a separate throwaway UI prototype was skipped.
- Direct-link Mini App entry (`?startapp`, `chat_instance` context)
- Implicit registration from scoring participation
- Dialogflow, Polly, `/stats`, and Humor decay
- AWS Lambda or CodeStar for v2
- redesigned-giggle's Kamal/TanStack deployment stack
- [What is the v1 → v2 cutover runbook?](issues/16-cutover-runbook.md) — retiring v1 and updating `master` happens only after v2 is proven operational.
