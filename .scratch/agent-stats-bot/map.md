# Agent-driven stats bot

## Destination

An implementation-ready specification and ticket set for a new Hono app in this monorepo that becomes
Mike-bot's sole active Telegram runtime on Vercel. It preserves reaction Event ingestion and replaces the
Mini App experience with one public `/stats` command powered by a Vercel AI SDK agent reading a Neon
database.

## Notes

- This effort charts and resolves the design. It does not implement the new app.
- This is a toy and an experiment. Prefer the smallest coherent design; omit migration choreography,
  backwards compatibility, production hardening, and package extraction.
- Code needed from `apps/web` will be copied into the new app. The existing Next.js app remains untouched.
- The Mini App button will be disabled manually in BotFather and is outside the code change.
- The bot operates in Telegram groups and supergroups. Private-chat behavior is outside the destination.
- Model output and generated SQL are nondeterministic. CI should verify deterministic tools and boundaries,
  not exact generated SQL or prose. Representative prompts may be retained as manual smoke checks.
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

- The new Hono app is the sole active bot runtime and is deployed to Vercel.
- The runtime continues recording eligible reaction Events exactly as the current bot does.
- `/stats` is the only command. Every invocation follows one agent flow; bare `/stats` does not take a
  separate deterministic application path.
- A bare `/stats` is interpreted as a request for the Current Season Leaderboard: all Members and the same
  five existing categories.
- Free-form text after `/stats` is a one-shot Stats question. There is no conversational memory or follow-up
  protocol in v1.
- The agent generates SQL because arbitrary Stats questions are the feature, not an escape hatch. Its tools
  provide read access to Neon; the exact safety and Chat-isolation mechanism remains to be designed.
- Missing dimensions default broadly: all categories when “what” is absent, all Members when “who” is
  absent, Current Season when “when” is absent, and analogous inclusive defaults elsewhere.
- Stats questions are limited to scoring statistics for the Chat in which the command was sent.
- Every outcome is public: either a rich Stats report or a concise rich explanation of why no report could
  be produced.
- Reports should be brief and avoid long prose. A result that cannot fit one Telegram message may continue
  across several consecutive public messages.
- New application code may copy from `apps/web`, but this effort will not create shared packages.
- `Stats question` and `Stats report` are recorded in the root domain glossary.
- The current contracts and copy/adapt/exclude ledger are inventoried in
  [Inventory the current bot contracts](issues/01-inventory-current-bot.md).
- [Normalize imported message metadata](issues/09-normalize-imported-message-authors.md): importing one new
  v1 row always creates one Event and creates its `message_authors` row only when absent; reruns can backfill
  missing message metadata without duplicating the Event.
- Current official integrations support one zero-configuration Hono app and one grammY webhook endpoint;
  `waitUntil` can carry the one-shot agent after acknowledgement but is not durable beyond the Vercel
  Function's duration. See [ticket 02](issues/02-research-runtime-stack.md).
- As of 2026-08-22, use configurable `openai/gpt-5.6-luna` through Vercel AI Gateway with
  `openai/gpt-5.6-terra` as fallback. Vercel's “free” tier is a recurring $5 monthly Gateway credit, not
  zero-price inference. See [ticket 03](issues/03-select-free-tier-model.md).

## Route to the destination

1. [Inventory the current bot contracts](issues/01-inventory-current-bot.md)
2. [Verify the Vercel, Hono, Telegram, and AI SDK shape](issues/02-research-runtime-stack.md)
3. [Select the free-tier model](issues/03-select-free-tier-model.md)
4. [Normalize imported message metadata](issues/09-normalize-imported-message-authors.md)
5. [Prove the SQL and Chat-isolation boundary](issues/04-prove-sql-boundary.md)
6. [Decide the model output contract](issues/12-decide-model-output-contract.md)
7. [Specify the agent and tool contract](issues/05-specify-agent-contract.md)
8. [Specify public Telegram reports](issues/06-specify-telegram-reports.md)
9. [Specify the direct development Stats harness](issues/10-specify-dev-stats-harness.md)
10. [Specify verification boundaries](issues/07-specify-verification.md)
11. [Specify the human infrastructure handoff](issues/11-specify-infrastructure-handoff.md)
12. [Write the implementation-ready specification and tickets](issues/08-write-implementation-plan.md)

## Fog

- Which current files and behaviors are authoritative for Event ingestion, Season resolution, the five
  categories, display identities, database access, and Telegram webhook setup?
- What is the smallest supported Hono-on-Vercel integration with grammY and Vercel AI SDK, including
  webhook acknowledgement, function duration, retries, and Telegram `allowed_updates`?
- Which currently free Vercel-hosted model is strongest at tool use and SQL for this small agent?
- How can the model retain arbitrary analytical SQL while the database tool guarantees read-only access and
  isolation to the invoking Chat? Prompt instructions alone do not establish that boundary.
- What schema context and business rules must the agent receive, and which details belong in hidden tool
  context rather than model-visible arguments?
- Which Telegram rich-text mode should reports use, and how should semantic sections be split without
  breaking formatting when a report spans messages?
- Which failures should be converted into a public explanation after one agent attempt?
- Which deterministic contracts deserve automated tests, and which end-to-end prompts are merely manual
  observations of a nondeterministic system?
