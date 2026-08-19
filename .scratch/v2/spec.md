Status: ready-for-agent

# v2: production-ready Telegram Mini App

## Problem Statement

The v2 bot and leaderboard are functionally implemented, but the current branch still contains development shortcuts and stale decisions that make it unsafe or misleading to take live. The Mini App reads Telegram's native browser global directly instead of using the TMA React SDK, API authentication trusts unsigned user data, the leaderboard can be read without proving Chat registration, and fixture data is inserted during ordinary requests. Local development does not reproduce a real TMA launch closely enough to exercise authenticated behavior. Tooling still permits lint warnings and duplicates environment-file discovery behind a custom abstraction. The map, specification, resolved tickets, domain documentation, and go-live guide also disagree with the intended behavior.

The result must be a small, friend-only system that is still internally honest: Telegram identity is validated, Chat access is enforced, production data is never silently seeded, local development is realistic and deterministic, and current documentation describes what the code actually does.

## Solution

Adopt `@tma.js/sdk-react` as the Mini App platform boundary and `@tma.js/init-data-node` as the server authentication boundary. The client will initialize the supported TMA lifecycle, forward untouched launch init data as `Authorization: tma …`, use Telegram theme and viewport values, and expose Telegram's native Back Button on the leaderboard. Protected APIs will validate the init-data signature and a one-year age limit before resolving the Member. Chat data will be returned only when that Member has explicitly registered in the requested Chat.

Development will use the TMA SDK's environment mocking pattern with valid init data signed by a fixed, non-secret development token for known deterministic personas. Fixture creation will move out of request handling into an explicit `db:seed` command built on official Drizzle Seed reset-and-seed behavior. Local PGlite is the safe default; resetting a remote PostgreSQL database requires explicit opt-in.

Karma plus and Karma minus remain independent append-only Marks. Registration uses ordinary bot-posted Registration messages and does not use Telegram pinning. Obsolete code, warnings, and contradictory historical artifacts will be removed rather than preserved as amendments. Human go-live work remains a concise README checklist and is not represented as unfinished agent work.

## User Stories

1. As a Member, I want the Mini App to use Telegram's maintained React SDK, so that it behaves consistently with the TMA platform.
2. As a Member, I want Telegram theme colors to be reflected in the Mini App, so that the UI feels native inside Telegram.
3. As a Member, I want the Mini App to respect Telegram viewport and safe-area values, so that controls are not obscured by Telegram chrome or device cutouts.
4. As a Member, I want the Mini App to expand to the available viewport and report readiness only after its shell is ready, so that Telegram does not reveal an incomplete interface.
5. As a Member viewing a leaderboard, I want Telegram's native Back Button to return me to the Chat picker, so that navigation follows Mini App conventions.
6. As a developer running outside Telegram, I want a visible local back control, so that I can test the same navigation without Telegram chrome.
7. As a Member opening the production URL outside Telegram, I want a Russian instruction to open it through Telegram, so that I see a useful explanation instead of failed requests.
8. As a Member, I want the Mini App to open only from the bot Menu Button, so that the launch and registration model stays simple.
9. As a Member, I want my untouched Telegram launch data sent with every protected API request, so that the server can authenticate me without trusting client-derived identity fields.
10. As a Member, I want invalid or forged launch data rejected, so that another person cannot impersonate me by changing a user id.
11. As a Member, I want launch data older than one year rejected, so that authentication has an explicit lifetime appropriate to this friend-only project.
12. As a Member, I want launch data signed slightly in the future because of ordinary clock skew handled sensibly, so that small clock differences do not break a legitimate launch.
13. As a Member, I want the Chat picker to contain only Chats where I registered, so that unrelated groups are never exposed.
14. As a Member, I want leaderboard requests authorized against my registration in the requested Chat, so that changing a query parameter cannot reveal another Chat.
15. As a Member with invalid, missing, or expired launch data, I want protected APIs to return an authentication error, so that the client can distinguish identity failure from other failures.
16. As an authenticated Member without registration in a requested Chat, I want the leaderboard API to return a forbidden error, so that access rules are explicit.
17. As an authenticated Member with no registered Chats, I want the existing Russian registration guidance, so that I know how to gain access.
18. As a developer, I want local development to mock Telegram launch, theme, viewport, and safe-area events, so that I can exercise the Mini App in an ordinary browser.
19. As a developer, I want local mock init data to carry a valid signature, so that development exercises the same server validation path as production.
20. As a developer, I want a small set of known seeded Member personas, so that registered, unregistered, and forbidden states are reproducible.
21. As a deployer, I want development signing facilities absent in production, so that the local convenience cannot become a production authentication bypass.
22. As a Member, I want 👍 to append one Karma plus Event, so that the append-only log records my positive Mark.
23. As a Member, I want 👎 to append one Karma minus Event, so that the append-only log records my negative Mark.
24. As a Member, I want 👍 and 👎 to be allowed simultaneously on the same message, so that Telegram's actual reaction state is represented without invented switching rules.
25. As a Member, I want simultaneous Karma plus and Karma minus contributions to cancel numerically in net Karma, so that aggregation follows directly from the Event log.
26. As a Member, I want removing 👍 to append one Karma plus undo Event, so that history is preserved while the contribution is reversed.
27. As a Member, I want removing 👎 to append one Karma minus undo Event, so that history is preserved while the contribution is reversed.
28. As a Member, I want Humor to remain independent of both Karma reactions, so that all three supported Marks follow the same append-only model.
29. As a group admin, I want `/register` to post an ordinary Registration message, so that Members can opt in without changing Telegram's pinned messages.
30. As a group admin, I want multiple Registration messages to remain valid, so that rerunning `/register` does not invalidate previous registration entry points.
31. As a Member, I want reacting to a Registration message to register me without creating a Scoring Event, so that access and scoring remain separate concepts.
32. As a developer, I want ordinary API requests never to create fixture records, so that reads are free of hidden writes.
33. As a developer, I want an explicit `db:seed` command, so that fixture creation is intentional and discoverable.
34. As a developer, I want `db:seed` to use official Drizzle Seed reset behavior, so that repeated runs produce a clean and deterministic database.
35. As a developer, I want local PGlite to be the default seed target, so that the safe path requires no cloud database.
36. As a deployer, I want remote database reset to require `ALLOW_REMOTE_DATABASE_SEED=1`, so that an ordinary command cannot erase remote data accidentally.
37. As a deployer who explicitly enables remote seeding, I want a prominent destructive-operation warning, so that the reset is unmistakable.
38. As a developer, I want fixture timestamps calculated relative to current `Europe/Moscow` Seasons, so that every supported Season view stays useful over time.
39. As a developer, I want deterministic fixture Members, registrations, and scores, so that UI behavior and tests are reproducible across machines.
40. As a developer, I want scripts to load `.env.local` and `.env` directly through dotenv, so that environment handling is obvious at each entry point.
41. As a developer, I want the custom environment-file loader removed, so that a small convention is not hidden behind unnecessary machinery.
42. As a developer, I want migration and operational scripts to prefer an unpooled database URL when provided, so that direct database operations retain the correct connection behavior.
43. As a maintainer, I want lint to fail on the first remaining warning, so that a green verification run means zero warnings.
44. As a maintainer, I want the existing unused-variable warning fixed, so that the zero-warning policy begins from a clean baseline.
45. As a maintainer, I want a test that enters through the Telegram webhook HTTP Route Handler, so that framework, secret-header, bot, and persistence wiring are verified together.
46. As a maintainer, I want protected API tests to use genuinely signed init data, so that tests cannot pass through an authentication shortcut that production rejects.
47. As a maintainer, I want the map, specification, tickets, domain model, ADRs, and README to use one current vocabulary, so that future work is planned from true assumptions.
48. As a maintainer, I want obsolete decisions removed rather than retained as historical amendments, so that agents do not rediscover and implement superseded behavior.
49. As a maintainer, I want v1 source absent from the `v2` branch, so that this branch contains only the current system.
50. As a bot operator, I want the one-shot v1 import capability to remain available, so that historical Events can still be loaded before cutover without retaining the v1 runtime source.
51. As a bot operator, I want all human go-live steps collected in the README, so that deployment and Telegram configuration can be completed without searching tickets.
52. As a bot operator, I do not want a human-only go-live ticket, so that the tracker represents agent-executable work rather than my personal checklist.
53. As a maintainer, I want package manifests, the lockfile, generated database artifacts, and documentation to agree after the change, so that the branch contains no artifact drift.
54. As a maintainer, I want formatting, zero-warning lint, type checking, build, and all tests to pass together, so that the hardened branch is ready for the human go-live steps.

## Implementation Decisions

### TMA client platform

- Use `@tma.js/sdk-react`; do not access the native `window.Telegram.WebApp` global directly and do not load Telegram's native JavaScript SDK manually.
- Initialize the SDK before reading launch parameters. Restore init data through the SDK and use the raw form unchanged for API authorization.
- Mount supported Mini App, theme-parameter, viewport, and Back Button components in the required order. Bind supported theme, Mini App, viewport, safe-area, and content-safe-area CSS variables.
- Expand the viewport after it mounts. Do not request fullscreen.
- Signal Mini App readiness after the application shell can render a meaningful state.
- Show the native Back Button only on the leaderboard screen. Its click action returns to the Chat picker and clears leaderboard navigation state.
- Render the existing visible back control only when the native Back Button is unavailable, including local browser development.
- The production non-TMA state is a dedicated Russian instruction to open the Mini App through Telegram. It must not issue protected API requests.
- Bot Menu Button remains the sole production launch path. Main Mini App links, direct links, `startapp`, inline-keyboard launch, and an `/app` command are not adopted.

### TMA authentication and Chat authorization

- The client sends raw init data in the `Authorization` header using the `tma` scheme on both Chat-picker and leaderboard requests.
- Use `@tma.js/init-data-node` on the server to validate the signature with `BOT_TOKEN` and to extract the authenticated Telegram user.
- Enforce a maximum init-data age of 365 days. This deliberately long lifetime is acceptable for this friend-only project.
- Do not trust a client-provided user id, decoded-but-unvalidated data, query parameter, cookie, or development header as production identity.
- Missing, malformed, invalidly signed, or expired init data returns HTTP 401 with a stable JSON error shape.
- The Chat-picker API returns only registrations belonging to the authenticated Member.
- The leaderboard API verifies a `chat_memberships` row for the authenticated Member and requested Chat before querying Events. A valid Member without that registration receives HTTP 403 with a stable JSON error shape.
- Invalid leaderboard query parameters remain HTTP 400. Authentication occurs before protected data is returned.
- Authentication and membership checks live behind a shared server boundary used by both protected APIs.

### Development TMA environment

- Follow the official TMA Next.js template pattern with `mockTelegramEnv` when development is not already running inside Telegram.
- Mock launch parameters, theme parameters, viewport, safe area, content safe area, and the SDK request/response events required by mounted components.
- Use a fixed, non-secret development bot token to sign mock init data. Production continues to use only `BOT_TOKEN`.
- A development-only server facility may issue valid signed launch data for an allowlist of deterministic seeded personas. It must be unreachable when the application is built or run as production.
- The default persona is registered in the seeded Chat. Additional known personas cover unregistered and forbidden leaderboard states.
- Local identity selection may use a development-only query parameter, but arbitrary identities are not signed and the mechanism is never accepted in production.

### Append-only reaction behavior

- 👍, 👎, and 🤣 are independent Telegram reactions. Do not enforce mutual exclusion or synthesize removal Events when another reaction is added.
- Diff Telegram's old and new reaction arrays. Each supported addition appends its add Event; each supported removal appends its corresponding undo Event.
- A state transition from no Karma reactions to both 👍 and 👎 appends both add Events. Removing one later appends only that reaction's undo Event.
- Aggregation remains additive. Karma plus contributes `+1`, Karma minus contributes `-1`, and their undo Events invert those contributions. Therefore simultaneous plus and minus cancel in net Karma without special treatment.
- Humor and its undo remain independent of Karma.
- Existing rules for self-Marking, bot-authored messages, uncached messages, append-only persistence, and Telegram update deduplication remain unchanged.

### Registration vocabulary and behavior

- `/register` posts a **Registration message** and records it in `registration_messages`.
- Telegram pinning is not used. User-visible copy, logs, comments, tests, documentation, map entries, and ticket text must not describe Registration messages as pins.
- Multiple Registration messages per Chat remain valid.
- Any supported added reaction on a Registration message registers the Actor in that Chat. Registration reactions do not create Scoring Events; reaction removal does not unregister the Member.
- Registration continues to gate Mini App visibility only. Marks accumulate for Members regardless of registration.

### Explicit deterministic database seeding

- Remove fixture seeding from Chat and leaderboard request paths. Protected GET requests perform no fixture writes.
- Add `drizzle-seed` and a separate `db:seed` package script.
- `db:seed` uses the official Drizzle Seed reset operation before inserting the fixture. For PostgreSQL this is destructive `TRUNCATE … CASCADE` behavior across the selected application schema.
- Default to a local PGlite target. The command migrates that target before resetting and seeding when necessary.
- A remote PostgreSQL target is refused unless `ALLOW_REMOTE_DATABASE_SEED=1` is set explicitly. When permitted, print a clear destructive reset warning identifying that a remote target was selected before reset begins.
- Use a fixed numeric generator seed and explicit refinements for deterministic Member identities, Chat membership relationships, and useful scoring distributions.
- Fixture Event timestamps are derived from the current time in `Europe/Moscow`, with coverage for the Current Season and supported historical navigation. Do not retain fixed August 2026 dates.
- Seed helpers may be shared by tests, but test setup remains explicit; importing or calling an API must never trigger seed behavior implicitly.

### Environment loading and scripts

- Delete the custom environment-file loading abstraction.
- Script and Drizzle configuration entry points call dotenv directly with `path: [".env.local", ".env"]`.
- Environment paths resolve according to the web workspace command's working directory. Documentation standardizes pulling or creating environment files in that workspace rather than searching multiple directory roots.
- Database migration, import, and seed operations prefer `DATABASE_URL_UNPOOLED`, then fall back to `DATABASE_URL`, using direct local expressions rather than a shared loader.
- Application runtime environment parsing remains schema-validated and does not use the script-only dotenv setup.

### Quality policy and verification

- Both lint and lint-fix scripts enforce `--max-warnings=0`.
- Fix all currently emitted warnings; do not suppress them merely to satisfy the gate.
- The required verification sequence is formatting check, zero-warning lint, typecheck, build, and full test suite.
- Dependency changes update the workspace manifest and lockfile together. Generated artifacts affected by schema or migration changes are regenerated and committed together.

### Documentation and tracker reconciliation

- Rewrite current canonical artifacts to state the final behavior directly. Remove superseded mutual-exclusion, unsigned-authentication, Registration-message pinning, automatic-seeding, retained-v1-source, and completed-deployment claims.
- Prune irrelevant historical explanations and amendments aggressively. Do not retain contradictory acceptance text merely as a record of how the decision evolved.
- Domain terminology is authoritative: Chat, Member, Actor, Subject, Mark, Event, Season, Current Season, Registration message, and Mini App.
- Keep an ADR for the TMA SDK and authentication boundary because it is a durable cross-cutting decision. Existing registration and Event-storage ADRs must agree with the final vocabulary and behavior.
- The README is the only human go-live checklist. It covers environment placement, database migration and optional v1 import, Vercel variables, deployment, webhook registration, BotFather Menu Button setup, group administrator/privacy requirements, `/register`, Member registration, verification, and common failures.
- Human go-live work is not represented by a new ticket and is not claimed as completed by agent-side verification.
- v1 runtime source remains absent from `v2`. The one-shot import implementation and instructions remain because they are still relevant to go-live.

## Testing Decisions

### Primary seam: protected API Route Handlers

- Treat the protected HTTP Route Handlers as the primary test seam for this effort.
- Construct real init data signed with a test bot token and send it through the same `Authorization: tma …` contract used by the client.
- For the Chat-picker API, cover valid registration, an authenticated Member with no registrations, missing authorization, malformed data, invalid signature, and data older than one year.
- For the leaderboard API, cover an authorized registered Member, a valid but unregistered Member receiving 403, invalid identity receiving 401, malformed query receiving 400, and absence of request-triggered fixture writes.
- Assert observable HTTP status and response JSON plus relevant persisted outcomes. Do not assert private validator call order or internal SQL structure.

### Telegram webhook Route Handler

- Add an HTTP-level integration test that enters through the POST webhook Route Handler with the configured Telegram secret header and a synthetic Telegram update.
- Use PGlite and assert the externally meaningful persistence result: the expected Event and processed update are present after the response succeeds.
- Cover a transition containing both 👍 and 👎 and later independent removal, proving that Events are appended without mutual-exclusion synthesis.
- Keep lower bot-adapter tests for detailed reaction diff, self-Mark, bot Subject, uncached message, registration, and duplicate-update cases.

### TMA application boundary

- Test behavior at the application/SDK boundary rather than testing `@tma.js` internals.
- Given mocked launch and component signals, verify that the client reaches its loading/content states, forwards raw init data, uses the production non-TMA screen when appropriate, and does not call protected APIs without a valid TMA environment.
- Verify that entering a leaderboard shows and wires the native Back Button, returning to the picker hides it, and the visible fallback exists only without native support.
- Prefer extracting a narrow SDK adapter if needed for deterministic tests; do not spread SDK mocks across components.

### Database seed operation

- Exercise the reset-and-seed operation against PGlite.
- Seed twice and assert the second run returns the database to the same deterministic personas, registrations, Events, and scores rather than accumulating duplicates.
- Freeze time at a Moscow Season boundary and assert generated Events populate the intended Current and historical Seasons.
- Test target selection separately: local PGlite is accepted by default, a remote URL is refused without opt-in, and explicit opt-in selects the remote path without connecting in the refusal test.
- Do not test Drizzle Seed's internal random generator or SQL text.

### Existing regression coverage

- Keep scoring aggregation tests as the authoritative seam for Event contribution math, Season bucketing, ranking, Crown, and Chicken behavior.
- Keep message/reaction handler and registration integration tests for bot-domain rules below the HTTP adapter.
- Update existing API tests to use signed init data instead of unsigned hand-built user parameters.
- Reuse existing PGlite helpers and request-level testing style where possible.

### Verification gates

- Formatting, zero-warning lint, type checking, production build, and the full test suite must all pass.
- These commands are verification gates, not substitutes for behavioral assertions.
- A good test asserts user-visible responses, platform navigation, or durable domain state. It does not lock in file layout, helper names, implementation call order, or third-party library internals.

## Out of Scope

- Performing the human Vercel, Neon, BotFather, Telegram group, v1 cutover, or `master` branch steps.
- Creating a human-only deployment ticket or claiming production is live.
- Changing `master` or restoring v1 runtime source to `v2`.
- Adding direct-link, Main Mini App, inline-keyboard, or command-based Mini App launch paths.
- Fullscreen mode.
- Short-lived sessions, refresh tokens, cookies, or a general-purpose authentication system. The accepted init-data lifetime is one year.
- Public/multi-tenant hardening beyond signed Telegram identity and Chat membership authorization, including rate limiting or an operator console.
- Unregistering when a Member removes a reaction from a Registration message.
- Making Karma plus and Karma minus mutually exclusive.
- Changing the existing five leaderboard sections, `Europe/Moscow` Season model, or append-only Event vocabulary.
- Automatic fixture insertion in production or during ordinary API reads.
- Preserving obsolete tracker prose for historical interest.

## Further Notes

- The project is friend-only, which is why a one-year init-data lifetime is accepted. Signature validation and Chat authorization are still required because they are simple invariants and prevent accidental cross-Chat access.
- The official TMA template's mock environment is the behavioral starting point, but its sample init-data signature is intentionally not valid for server authentication. Development therefore adds valid signing with a non-secret dummy token while keeping production validation tied to the real bot token.
- Drizzle Seed's PostgreSQL reset uses cascading truncation. `db:seed` must be documented as destructive, even though its safe default is local PGlite.
- Completing this specification makes the branch ready for the user's separate go-live checklist; it does not itself make the deployment live.
