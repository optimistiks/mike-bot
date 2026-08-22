# 01: Inventory the current bot contracts

Type: research
Status: resolved

## Question

Which behavior and code in `apps/web` must be copied to preserve reaction Event ingestion and give the new
agent an accurate scoring model? Identify the authoritative modules, database schema, invariants, tests,
environment variables, and webhook setup for:

- eligible reactions and compensating Events;
- Chat isolation and display identities;
- Season boundaries and the five Leaderboard categories;
- Neon access and migrations;
- grammY update handling and webhook registration.

Separate the copy set from Mini App, Registration, and HTTP Leaderboard code that the new app does not need.
Record factual findings only; do not refactor or implement.

## Done when

- The answer contains a file-level copy ledger and a behavior-level preservation checklist.
- It identifies existing tests worth copying and gaps that later tickets must cover.
- It names any coupling that prevents a literal copy into an independent Hono app.

## Answer

### Authoritative contracts

The current implementation has three distinct contracts that the new app must preserve:

1. Telegram updates are converted into an append-only Event log by
   [`handle-update.ts`](../../../apps/web/lib/bot/handle-update.ts),
   [`reaction-events.ts`](../../../apps/web/lib/bot/reaction-events.ts), and
   [`emojis.ts`](../../../apps/web/lib/bot/emojis.ts). The design rationale is recorded in
   [ADR-0004](../../../docs/adr/0004-event-storage.md) and
   [ADR-0005](../../../docs/adr/0005-message-author-cache.md).
2. Event types, seasonal attribution, and score contributions are defined by
   [`event.ts`](../../../apps/web/lib/domain/event.ts) and the files under
   [`lib/scoring`](../../../apps/web/lib/scoring). The mixed v1/v2 database projection is defined by
   [`leaderboard/query.ts`](../../../apps/web/lib/leaderboard/query.ts).
3. Storage and webhook idempotency are defined by
   [`db/schema.ts`](../../../apps/web/lib/db/schema.ts),
   [`db/production.ts`](../../../apps/web/lib/db/production.ts), and the committed
   [`drizzle`](../../../apps/web/drizzle) migrations. The transaction requirement is recorded in
   [ADR-0008](../../../docs/adr/0008-neon-tcp-and-pglite.md).

### File-level copy ledger

#### Copy substantially unchanged

| Current file | Contract carried into the new app |
| --- | --- |
| [`lib/bot/chat.ts`](../../../apps/web/lib/bot/chat.ts) | Only Telegram `group` and `supergroup` are eligible Chats. |
| [`lib/bot/display-name.ts`](../../../apps/web/lib/bot/display-name.ts) | Prefer `@username`; otherwise use `first_name`. |
| [`lib/bot/emojis.ts`](../../../apps/web/lib/bot/emojis.ts) | The eligible Scoring reactions are exactly 👍, 👎, and 🤣. |
| [`lib/bot/reaction-events.ts`](../../../apps/web/lib/bot/reaction-events.ts) | Diff complete Telegram reaction states and map additions/removals to the six Event types. |
| [`lib/domain/event.ts`](../../../apps/web/lib/domain/event.ts) | Closed six-value Event vocabulary and Event boundary validation. |
| [`lib/scoring/contributions.ts`](../../../apps/web/lib/scoring/contributions.ts) | The signed contribution of every Event type to the five scoring buckets. |
| [`lib/scoring/season.ts`](../../../apps/web/lib/scoring/season.ts) | Moscow calendar-month boundaries and the ten-minute closing grace period. |
| [`lib/scoring/aggregate.ts`](../../../apps/web/lib/scoring/aggregate.ts), [`types.ts`](../../../apps/web/lib/scoring/types.ts), and [`index.ts`](../../../apps/web/lib/scoring/index.ts) | Five-category aggregation, ranking, tie behavior, and public scoring types. |
| [`lib/leaderboard/query.ts`](../../../apps/web/lib/leaderboard/query.ts) | Canonical projection of legacy and v2 Events into one Season; also the clearest executable reference for agent SQL semantics. |
| [`lib/leaderboard/schema.ts`](../../../apps/web/lib/leaderboard/schema.ts) | Existing Leaderboard result shape, if retained as a typed internal boundary rather than an HTTP API. |
| [`lib/env.ts`](../../../apps/web/lib/env.ts) | Validation for the three existing runtime variables. |
| [`lib/bot/webhook-setup.ts`](../../../apps/web/lib/bot/webhook-setup.ts) | Registered update types and post-registration verification. |

These files use the `@/` alias in several imports; either the new app must define the same alias or those imports must become local to the new app.

#### Copy, but remove existing-app coupling

| Current file | Required adaptation |
| --- | --- |
| [`lib/bot/handle-update.ts`](../../../apps/web/lib/bot/handle-update.ts) | Keep update claiming, message-author caching, Display identity upserts, reaction eligibility, Season closing, and Event insertion. Remove Registration-message handling, Registration writes, `chat_member` Registration cleanup, and imports from `lib/db/registrations`, `lib/bot/register`, and `lib/mini-app/membership-status`. |
| [`lib/bot/bot.ts`](../../../apps/web/lib/bot/bot.ts) | Retain grammY bot construction, but replace `/register` detection and dispatch with `/stats`. The current callback supplied to `handleTelegramUpdate` runs inside the same interactive database transaction as update claiming; a literal replacement would therefore keep model/tool execution and Telegram replies inside that transaction. |
| [`lib/db/schema.ts`](../../../apps/web/lib/db/schema.ts) | The new runtime needs `events`, `display_identities`, `message_authors`, and `processed_updates`. `registrations` and `registration_messages` are Mini App contracts and are not needed by the destination. |
| [`lib/db/production.ts`](../../../apps/web/lib/db/production.ts), [`client.ts`](../../../apps/web/lib/db/client.ts), and [`runtime.ts`](../../../apps/web/lib/db/runtime.ts) | Preserve the module-scoped `pg` Pool, `attachDatabasePool`, Drizzle schema, and interactive transactions. Remove the `server-only` poison import outside Next.js. `runtime.ts` also brings local PGlite behavior that can be copied only if the new app keeps that local/test setup. |
| [`lib/db/pglite.ts`](../../../apps/web/lib/db/pglite.ts) | Reusable test adapter, but its migration directory is resolved relative to the current `apps/web/lib/db` location and must point at the new app's chosen migration ledger. |
| [`drizzle.config.ts`](../../../apps/web/drizzle.config.ts) and [`drizzle`](../../../apps/web/drizzle) | Existing production state was built by all three migrations. A literal migration-history copy also creates the two excluded Registration tables because `0000` creates their old names and `0001`/`0002` complete and rename them. A pruned new-app schema therefore cannot use the existing history unchanged for a fresh local database. |
| [`app/api/telegram/route.ts`](../../../apps/web/app/api/telegram/route.ts) | Its useful behavior is memoizing one grammY `std/http` handler and validating the webhook secret. The Next.js Route Handler and `server-only` wrapper are not portable; Hono must expose the request endpoint. |
| [`scripts/set-webhook.ts`](../../../apps/web/scripts/set-webhook.ts) | Preserve `setWebhook`, `secret_token`, `allowed_updates`, and verification. Its URL validation is hard-coded to `/api/telegram` and must match the Hono route selected by the new app. |

#### Do not copy

- [`lib/bot/register.ts`](../../../apps/web/lib/bot/register.ts),
  [`lib/db/registrations.ts`](../../../apps/web/lib/db/registrations.ts), and their tests implement `/register` and Registration-message access.
- Everything under [`lib/mini-app`](../../../apps/web/lib/mini-app), the root Mini App pages/components, and
  [`app/api/chats`](../../../apps/web/app/api/chats) implement Telegram Mini App authentication, Chat selection, and Registration authorization.
- [`app/api/leaderboard`](../../../apps/web/app/api/leaderboard) is the HTTP Leaderboard API. The internal scoring/query code above remains authoritative, but this transport and its Mini App authorization are outside the destination.
- Prototype UI routes/components and browser tests do not participate in bot ingestion or scoring.
- Import and seed scripts are not runtime dependencies. The legacy projection in `queryLeaderboard`, the `legacy_id` column, and its tests remain relevant because imported rows already live in the database.

### Behavior-level preservation checklist

- [ ] Claim `update_id` by inserting into `processed_updates` with conflict-ignore before applying any effects. Claiming and all effects happen in one database transaction; a failure rolls the claim back so Telegram can retry.
- [ ] Ignore messages and reactions outside groups/supergroups.
- [ ] Cache each observed message by `(chat_id, message_id)` with author ID, bot flag, and Telegram message timestamp. Conflict-ignore makes the first observation authoritative, and no message text is stored.
- [ ] Ignore a reaction when its message was not observed and therefore has no cached Subject.
- [ ] Ignore reactions without a concrete non-bot `reaction.user`, self-Marks, bot-authored Subjects, custom emoji, paid reactions, and ordinary non-scoring emoji.
- [ ] Diff `old_reaction` and `new_reaction` as complete sets. Process removals before additions, so changing 👍 to 👎 appends `karma.undo.plus` followed by `karma.minus`.
- [ ] Map additions to `karma.plus`, `karma.minus`, and `humor.add`; map removals to `karma.undo.plus`, `karma.undo.minus`, and `humor.undo.add`. Never update or delete an earlier Event.
- [ ] Derive v2 Event eligibility from the marked message's Moscow Season and the Telegram reaction timestamp. Accept actions strictly before ten minutes after Season end; reject actions at or after the cutoff.
- [ ] Store the reaction action timestamp in `events.created_at`, even though v2 seasonal attribution uses the cached message timestamp.
- [ ] Scope message lookup, Event writes, Display identity writes, and every stats read to the command's `chat_id`. The same Telegram Member can have a different Display identity in each Chat.
- [ ] Upsert the latest Display identity for non-bot message authors and eligible reaction Actors. Use `@username` when present and `first_name` otherwise. Existing reads fall back to `User <id>` when no identity row exists.
- [ ] For already-imported rows where `legacy_id IS NOT NULL`, attribute the Season using `events.created_at`. For native v2 rows where `legacy_id IS NULL`, join `message_authors` on both Chat and message ID, select by the message timestamp, and enforce the action cutoff.
- [ ] Preserve the five Leaderboard buckets and titles: `Уважаемые люди` (net Karma received by Subject), `Юмористы` (net Humor received by Subject), `Поставили +` (Karma plus given by Actor), `Поставили −` (Karma minus given by Actor), and `Поставили лол` (Humor given by Actor).
- [ ] Omit zero totals. Rank descending by score and then ascending by Member ID. Every top tie gets Crown; every bottom tie gets Chicken only when the top and bottom scores differ.

The contribution matrix that agent-generated SQL must reproduce is:

| Event type | Subject: Karma | Subject: Humor | Actor: plus given | Actor: minus given | Actor: Humor given |
| --- | ---: | ---: | ---: | ---: | ---: |
| `karma.plus` | +1 | 0 | +1 | 0 | 0 |
| `karma.undo.plus` | -1 | 0 | -1 | 0 | 0 |
| `karma.minus` | -1 | 0 | 0 | +1 | 0 |
| `karma.undo.minus` | +1 | 0 | 0 | -1 | 0 |
| `humor.add` | 0 | +1 | 0 | 0 | +1 |
| `humor.undo.add` | 0 | -1 | 0 | 0 | -1 |

### Database, environment, and webhook facts

- `events` is append-only by application convention. It has an indexed `(chat_id, created_at)` access path and a unique nullable `legacy_id`, but the database has no check constraint on the text `type`; application code validates it with `eventTypeSchema` when building the existing Leaderboard.
- `display_identities` is keyed by `(chat_id, user_id)`, `message_authors` by `(chat_id, message_id)`, and `processed_updates` by `update_id`. The schema defines no foreign keys between them.
- Production uses a module-scoped TCP `pg` Pool with Vercel Fluid lifecycle attachment. Interactive transactions are required by the current atomic update-claim pattern. Runtime uses pooled `DATABASE_URL`; Drizzle migrations prefer `DATABASE_URL_UNPOOLED` and fall back to `DATABASE_URL`.
- Existing runtime variables are `BOT_TOKEN`, `BOT_WEBHOOK_SECRET`, and `DATABASE_URL`. Webhook registration additionally needs `WEBHOOK_URL`; local database helpers optionally use `PGLITE_DATA_DIR`, and the destructive remote seed path uses `ALLOW_REMOTE_DATABASE_SEED`.
- The webhook currently requests exactly `message`, `message_reaction`, and `chat_member`. `message` is required both for commands and Subject caching; `message_reaction` is required for Marks. `chat_member` currently updates identity and removes Registration on leave/kick, so its only scoring-adjacent effect is identity refresh; the Registration-free destination has no corresponding cleanup behavior.
- [`app/api/telegram/route.ts`](../../../apps/web/app/api/telegram/route.ts) passes `BOT_WEBHOOK_SECRET` to grammY's `webhookCallback(..., "std/http", { secretToken })` and memoizes handler construction for a warm module instance.

### Tests worth copying

Copy these tests with import/path changes and the Registration cases removed where noted:

- [`reaction-events.test.ts`](../../../apps/web/lib/bot/reaction-events.test.ts): complete add/remove/switch matrix, ignored emoji, self-Mark, bot Subject, and full-state diffing.
- [`domain/event.test.ts`](../../../apps/web/lib/domain/event.test.ts): six-value Event vocabulary and complete Event record parsing.
- [`scoring/aggregate.test.ts`](../../../apps/web/lib/scoring/aggregate.test.ts): all contribution signs, Moscow boundaries, exact grace cutoff, five sections, undo netting, Season filtering, deterministic order, Crown, and Chicken.
- [`leaderboard/query.test.ts`](../../../apps/web/lib/leaderboard/query.test.ts): Display identity join, invalid stored Event type, grace-window query behavior, cutoff exclusion, and legacy attribution.
- The scoring-related cases in [`handle-update.test.ts`](../../../apps/web/lib/bot/handle-update.test.ts): message cache through visible score, concurrent duplicate update, uncached message, grace acceptance/rejection, private-chat rejection, bot-authored cache behavior, and transaction rollback/retry. Do not copy its Registration and `chat_member` cleanup cases.
- [`db/migrations.test.ts`](../../../apps/web/lib/db/migrations.test.ts), reduced to the four retained tables, plus its `legacy_id` uniqueness case if the new app establishes its own local migration baseline.
- [`db/runtime.test.ts`](../../../apps/web/lib/db/runtime.test.ts) if PGlite remains the new app's local/test database.
- [`env.test.ts`](../../../apps/web/lib/env.test.ts), [`webhook-setup.test.ts`](../../../apps/web/lib/bot/webhook-setup.test.ts), and the warm-handler assertion from [`app/api/telegram/route.test.ts`](../../../apps/web/app/api/telegram/route.test.ts), adapted to the Hono transport.
- The `isGroupChat` truth table currently located in [`register.test.ts`](../../../apps/web/lib/bot/register.test.ts) should move with `chat.ts`; the remainder of that file is excluded.

### Gaps for later tickets

- No existing test places identical Member/message IDs or scoring activity in two Chats and proves that ingestion, identity resolution, and stats reads cannot cross the Chat boundary. Chat isolation is implemented and documented in [ADR-0009](../../../docs/adr/0009-chat-scoped-identity-and-access.md), but lacks a direct regression test.
- No dedicated test proves Display identity overwrite behavior when a Member changes username, or the `first_name` and `User <id>` fallbacks.
- `message_reaction` updates represented by `actor_chat` rather than `user` are silently ignored by the current handler and are not covered by a test.
- The database accepts unknown `events.type` text and depends on application parsing. Existing coverage proves the Leaderboard query rejects such a value; arbitrary agent SQL would not inherit that validation automatically.
- The current handler tests combine retained scoring cases with Registration/Mini App imports, so they cannot be copied literally into an independent app.
- There is no `/stats` command, agent tool, generated-SQL, Rich Message, multi-message response, or Hono webhook coverage in the current codebase. Those are wholly new contracts.
- The current query has two physical representations of the same message-time attribution rule: native v2 rows use `message_authors.message_date`, while imported rows use `events.created_at` as a surrogate. The destination rejects that split; [Normalize imported message metadata](09-normalize-imported-message-authors.md) must make imported Events resolve through `message_authors` before the agent schema is designed.
