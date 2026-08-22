# Agent-driven stats bot

## Destination

An implementation-ready specification and ticket set for a new Hono app in this monorepo that becomes
Mike-bot's sole active Telegram runtime on Vercel. It preserves reaction Event ingestion and replaces the
Mini App experience with one public `/stats` command powered by a Vercel AI SDK agent reading a Neon
database.

## Notes

- This effort charts and resolves the design. It does not implement the new app.
- This is a toy and an experiment. Prefer the smallest coherent design; omit migration choreography,
  backwards compatibility, and production hardening.
- Use the root domain glossary and ADRs as the domain authority. New application code may copy from
  `apps/web`, but this effort does not introduce shared packages.
- The new Hono app must retain the current app's PGlite-powered local/test database experience; automated
  tests must not require a live Neon database.
- Development must expose a direct HTTP Stats harness that can be called from Postman without Telegram. It
  must invoke the same agent pipeline as `/stats`, not a second implementation. Its exact request, response,
  environment exposure, and database choice remain to be specified.
- Deployment requires two human-supplied database connections: the operational database URL used by bot
  ingestion/import/migrations and a separate read-replica URL used exclusively by the agent SQL tool. The
  Neon project may be new or existing.
- The final implementation plan must identify every dashboard, credential, environment-variable, migration,
  webhook, and BotFather action that only the human can perform, with explicit handoff and verification steps.
- Agents and automated tests must never call a real language model or spend Vercel AI Gateway credit. Prompt,
  tool-loop, failure, and rendering integration is verified with a deterministic model double; only the human
  may trigger live-model checks after the infrastructure handoff is complete.
- Structured Outputs are not assumed merely because the selected models advertise support. Their value for
  the final agent-to-renderer boundary must be decided without live inference before the agent contract is
  specified.

## Decisions so far

- [Define the agent-driven bot product contract](issues/13-define-product-contract.md): one public,
  Chat-scoped `/stats` agent flow replaces the Mini App experience while reaction Event ingestion continues.
- [Inventory the current bot contracts](issues/01-inventory-current-bot.md): the authoritative behavior,
  copy/adapt/exclude ledger, preserved tests, and literal-copy obstacles are identified.
- [Verify the Vercel, Hono, Telegram, and AI SDK shape](issues/02-research-runtime-stack.md): one Hono app and
  one grammY webhook endpoint suffice; `waitUntil` is acceptable for this nondurable toy workflow.
- [Select the free-tier model](issues/03-select-free-tier-model.md): as of 2026-08-22, use configurable
  `openai/gpt-5.6-luna` with `openai/gpt-5.6-terra` fallback against Vercel's recurring $5 Gateway credit.
- [Normalize imported message metadata](issues/09-normalize-imported-message-authors.md): importing one new
  v1 row always creates one Event and creates its `message_authors` row only when absent; reruns can backfill
  missing message metadata without duplicating the Event.

## Not yet specified

No additional fog is currently visible beyond the open child tickets. Resolving the frontier may expose new
questions; add them here only until they become precise enough for tickets.

## Out of scope

- Changes to the existing Next.js app, Mini App, Registration flow, or HTTP Leaderboard API. The human will
  disable the Mini App button separately in BotFather.
- Private-chat behavior; the bot operates in Telegram groups and supergroups.
- Shared-package extraction; needed code is copied into the new Hono app.
- Conversational follow-ups or retained model history; each Stats question is one-shot.
- Backwards-compatible cutover, transition periods, production-hardening programmes, or a durable job queue.
- Agent-triggered live-model evaluation or any automated use of the human's AI Gateway credit.
