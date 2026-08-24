# Spec: Deepen the scoring, Leaderboard, and ingestion modules

Status: ready-for-agent

## Problem Statement

Mike-bot works, but three things in it are written down more than once, and one thing is written
down in a place that makes it untestable.

A Member reading a Leaderboard is trusting a rule — which Season a Mark belongs to — that the
codebase expresses four separate times, twice in TypeScript and once in SQL and once more in the
import dump tooling. Nothing holds those four copies together and no test compares them, so a
Season can appear in the Mini App's Season drawer and render empty, or a Mark can count in one
view and not another, with no failing test anywhere.

A Member opening a yearly Leaderboard waits for twelve separate Season queries, twelve of which
re-read the whole Chat's Display identities, and then sees Crown and Chicken flair computed by a
second implementation of the ranking rules that the scoring module already implements — over a
slightly different data shape, with its own tie-break comparator that happens to agree today.

A maintainer changing anything in the Telegram ingestion path pays for it in an integration suite
that has grown to 883 lines against 375 lines of code, because every domain decision in that path
is interleaved with a database write: asking "would this update write anything?" requires standing
up a database and posting a webhook payload. The same eligibility rules — group Chat, self-mark,
bot Subject, forum-topic guard, Season still open, readable timestamp — are implemented twice,
once on the Scoring reaction path and once on the Scoring reply path.

And the codebase still carries support for a Telegram group upgrading to a supergroup: five
hand-written SQL table moves, a delete loop, and a webhook test, serving an event that happens at
most once per Chat and has never happened to any Chat Mike-bot serves.

## Solution

Five changes, landing in order, that remove the duplication and put one seam where the ingestion
path currently has none.

Mike-bot serves supergroups. The group-to-supergroup upgrade path is deleted outright, along with
the predicate that treated plain groups and supergroups as one kind of Chat, and the private-chat
branch of the Stats command.

A Mark belongs to the Season of its Message's post time. That is the whole rule, and it is the only
place Season attribution is decided on the read path. Eligibility — whether a Scoring action landed
early enough to place a Mark at all — stays where it already is, a gate at write time. Imported
Marks stop being a special case anywhere in the code: the import already writes their Message post
times, so they are credited exactly like every other Mark.

A Leaderboard for any Leaderboard period is one database read and one aggregation. Crown and
Chicken, tie-breaks, section order, and zero-suppression exist once.

The Mini App's protected routes get two guards that concentrate the authenticate-parse-authorize
ceremony they each repeat.

The Telegram ingestion path gains one seam: reading a Telegram update into the facts it implies is
separated from writing those facts. Reading becomes a total function that needs no database, so the
edge cases become values to assert rather than rows to fetch. grammY stops leaking past the bot
module.

## User Stories

1. As a Member, I want a Season shown in the Season drawer to contain the Marks I expect, so that the
   Mini App does not offer me a Season that renders empty.
2. As a Member, I want a Mark to count in exactly one Season, so that monthly totals sum to the annual
   total the way ADR-0003 promises.
3. As a Member, I want my yearly Leaderboard to load without twelve sequential round trips, so that
   opening a year feels like opening a Season.
4. As a Member, I want Crown and Chicken flair on a yearly Leaderboard to follow the same rules as on a
   Season Leaderboard, so that a tie is treated the same way in both.
5. As a Member, I want a yearly Leaderboard to be correct even when January holds no Marks, so that an
   empty first month does not produce an empty year.
6. As a Member whose Marks were imported from v1, I want my historical standings to be attributed
   consistently, so that the Leaderboard does not disagree with itself about which Season a v1 Mark
   belongs to.
7. As an Actor, I want a Scoring reaction on a Message from a closed Season to be ignored, so that late
   marking cannot alter a settled Leaderboard.
8. As an Actor, I want a Scoring reply on a Message from a closed Season to be ignored on the same terms
   as a Scoring reaction, so that the input I choose does not change the rule.
9. As an Actor, I want the Undo window to keep behaving exactly as it does today, so that a misclick is
   still recoverable for five seconds and permanent after.
10. As an Actor, I want a redelivered Telegram update never to resurrect a Mark I took back, so that
    webhook retries stay invisible to me.
11. As a Member, I want the Stats command inside a Chat to register me and link to that Chat's current
    Leaderboard, so that access still begins where it always did.
12. As a Member, I want the Stats command sent privately to do nothing at all, so that no meaningless
    Registration appears in my Chat list.
13. As a Member, I want the Mini App's Chat list to contain only Chats I actually registered in, so that
    the selector stays truthful.
14. As a Member, I want a request for another Chat's Leaderboard to be refused, so that ADR-0009's
    isolation holds at every protected route.
15. As a Member, I want an unauthenticated request refused with the same status regardless of which
    route I hit, so that the Mini App's retry logic behaves predictably.
16. As a Member, I want a malformed Chat id to be refused as a bad request rather than a server error,
    so that a broken deep link fails cleanly.
17. As a Member, I want another Member's profile photo to be served only when we share a Chat, so that
    identity alone never grants visibility.
18. As a maintainer, I want the Season attribution rule to exist in one place, so that changing the
    grace period is one edit rather than four.
19. As a maintainer, I want no branch anywhere on the read path that asks whether a Mark came from v1,
    so that Imported Marks are genuinely dissolved into the model as ADR-0015 intended.
20. As a maintainer, I want the Leaderboard query module to stop expressing scoring rules in SQL, so
    that scoring logic lives where the scoring tests are.
21. As a maintainer, I want to ask "does this Telegram update write anything?" without a database, so
    that ingestion edge cases are cheap to cover and cheap to read.
22. As a maintainer, I want the Scoring reaction path and the Scoring reply path to share one statement
    of eligibility, so that a rule fixed on one path is fixed on both.
23. As a maintainer, I want grammY's Context confined to the bot module, so that everything below it can
    be tested without constructing a bot runtime.
24. As a maintainer, I want the post-commit announcement to be a value returned from the ingestion
    module, so that no callback is needed to smuggle a result out of a transaction.
25. As a maintainer, I want the protected routes to share one statement of the authenticate-parse-authorize
    ceremony, so that a fifth route cannot forget a step.
26. As a maintainer, I want the supergroup-upgrade machinery gone, so that no future reader mistakes it
    for a supported scenario or extends it when adding a Chat-scoped table.
27. As a maintainer, I want CONTEXT.md to stop describing Imported Marks as timestamp-special, so that
    the glossary matches the shipped model.
28. As a maintainer, I want the decisions recorded as ADRs, so that a future architecture review does
    not re-suggest the supergroup table registry or the provenance branch.
29. As an AFK agent, I want each change to land as its own commit with its own verification, so that a
    failure is attributable to one change.

## Implementation Decisions

### Sequencing

Five changes, in this order, each its own commit: (1) delete the supergroup-upgrade path, (2) one
Season rule, (3) one aggregation per Leaderboard period, (4) route guards, (5) the interpretation
seam. The order is load-bearing in two places: (2) must precede (3), because the annual query cannot
collapse to one range while the provenance branch stands; and (1) should precede (5), because there
is no point moving guards into interpretation that are about to be deleted. (4) is independent and
sits fourth only to keep the two ingestion-path changes from interleaving.

Documentation lands with the change that causes it, not in a pass at the end.

### 1 — Delete the supergroup-upgrade path

- The Chat migration handler, the `migrate_to_chat_id` branch that invokes it, and its webhook test
  are deleted. Mike-bot does not carry a Chat's history across a Telegram group upgrade.
- The predicate that treated `group` and `supergroup` as one kind of Chat is deleted. In its place,
  four inline comparisons against `supergroup`: one early return in each of the three update
  handlers, and one in the Stats command module. This is a deliberate choice of a repeated literal
  over a one-line predicate that wraps an equality check; it is not an abstraction worth keeping.
- The private-chat branch of the Stats command is deleted, along with its message constant. A Stats
  command sent privately is ignored: no Registration is written and no reply is sent. The Mini App's
  Chat selector remains reachable by launching the Mini App directly.
- No junk rows anywhere: the guards in the update handlers exist specifically so that a private
  message does not cache a Message row or a Display identity under a positive Chat id.
- CONTEXT.md: the **Chat** entry becomes supergroup-only and notes that a Telegram upgrade is not
  carried over; the **Stats command** entry loses its private-chat clause.
- New ADR: *Mike-bot serves supergroups and assumes stable Chat ids*, recording both the dropped
  upgrade path and the dropped plain-group support as one scope decision. This is what stops a future
  architecture review from proposing a Chat-scoped table registry to keep the migration honest.

### 2 — One Season rule

This implements a decision already resolved and never applied — see
`.scratch/agent-stats-bot/issues/09-normalize-imported-message-authors.md`, which concluded that every
stats query derives Season attribution from the cached Message post time and that the
provenance-specific branch in the Leaderboard query must be removed during implementation.

- **The rule**: a Mark belongs to the Season of its Message's post time.
- The provenance branch in the Season Leaderboard query is deleted. Imported Marks are credited by
  their Message's post time like every other Mark; the import already writes that post time as the
  earliest v1 Mark timestamp on the Message, so no import change is required.
- The read-side cutoff comparing a Mark's creation time against the Season's close is deleted. It
  guards against rows that ingestion never writes: both ingestion adapters already refuse to place a
  Mark whose Season has closed. Eligibility is a write-time gate; attribution is a read-time lookup;
  they are different concerns and stop sharing an expression.
- The left join from Marks to cached Messages becomes an inner join. A Mark with no cached Message has
  no Season and correctly does not appear.
- The available-Seasons query and the equivalent logic in the import dump tooling become a distinct
  Season-of-Message-post-time read. Both stop re-deriving the rule.
- The write-time gate is renamed to say what it does — it answers "is this Season still open?", not
  "which Season is credited". Its Season arithmetic, its Moscow boundaries, and the epoch-seconds form
  the query needs all live in the scoring module's Season interface.
- After this change the Mark's creation time is read by nothing on the Leaderboard path. It retains
  only the job ADR-0015 gave it: ordering the Undo window.
- **Accepted behaviour change**: a v1 Mark placed in a different calendar month than the earliest v1
  Mark on the same Message moves from its own month to the Message's month. It shifts rather than
  disappears, because the read-side cutoff is removed in the same change. This is a correction, not a
  regression, and there are no production users to migrate.
- CONTEXT.md: the **Season** entry loses the sentence crediting Imported Marks by their v1 timestamp;
  the **Imported Mark** entry states that nothing distinguishes an Imported Mark in the model, and that
  its v1 timestamp is its Message's post time.
- New ADR: *Imported Marks are credited like every other Mark*, amending ADR-0003 on that one point and
  pointing back at it. ADR-0003's other claims — Message-based Seasons, the ten-minute grace, Telegram
  timestamps over processing time — all still hold, so it is not superseded.

### 3 — One aggregation per Leaderboard period

- The scoring module's Mark input type drops its Season field and carries only Mark type, Actor, and
  Subject. The query scopes the rows; the aggregation ranks what it is given.
- The aggregation interface takes a Leaderboard period — one Season or one year — and uses it only to
  label whether the period is the Current Season.
- The annual path's twelve Season queries, its section-template reconstruction, and its second
  implementation of Crown and Chicken ranking are deleted. A year is one Message-post-time range.
- Display identities do not cross the scoring seam. The scoring module stays keyed on Member id and the
  Leaderboard query module attaches Display identities after aggregation, exactly as the Season path
  does today.
- Result: one Marks read plus one Display identities read per Leaderboard period, down from twenty-four
  round trips for a year.

### 4 — Route guards

- Two guards: one for Chat-scoped access, one for Member-scoped access. Two named adapters rather than
  one guard taking an access predicate, because the two genuinely differ in what they parse and in which
  access question they ask.
- Each guard returns either nothing (the request may proceed) or the refusal Response itself, already
  carrying the correct status and body. A boolean would collapse three distinct outcomes — unauthenticated,
  unparseable, unauthorized — into one and leave each route writing the three bodies again.
- Each guard performs the access check itself, so no route needs the authenticated Member afterwards: all
  four currently use it only to ask the access question.
- Each guard resolves the database handle itself. The runtime database is a module-level singleton in both
  adapters, so the route's own resolution costs nothing.
- The routes keep their existing return shapes: the two JSON routes and the two photo routes differ in
  what they return on success, which is why this is a guard rather than a wrapper around the handler.
- The deliberate note atop the Member photo route — that authorization stays per-request and must never be
  answered from a cache — is preserved. A guard runs per request and outside any cache boundary, so the
  property holds; the reasoning should move with it rather than be dropped.

### 5 — The interpretation seam

- One new module reads a Telegram update into the facts it implies. Its interface is a total function of
  the update, the cached Message it concerns (or its absence), and the bot's username. It performs no
  database access and no network access.
- The applier claims the update id first and only interprets on a successful claim, so interpretation
  never sees a redelivered update and stays a function of Chat facts alone.
- The cached Message lookup is hoisted into the applier and passed in. The Scoring reaction path needs
  exactly one lookup and it is the same one every time; hoisting it is what keeps interpretation total.
- The facts are **declarative writes**, not decisions: the Messages to cache, the Display identities to
  touch, the Mark changes to apply, the Registration to add or remove, the Chat metadata to mirror, and
  the announcements to send after commit. The applier is a straight-line executor that knows which table
  each fact implies. Skip reasons ride along as a field, feeding the existing diagnostic logging.
- Both post-commit announcements — the Scoring reply acknowledgement and the Stats command reply — become
  facts. The ingestion module's interface loses its callback parameter and instead returns whether the
  update was claimed together with what to send after commit.
- grammY's Context does not cross the seam. Interpretation works on the raw update; command detection
  becomes a text check inside interpretation. The bot module becomes the only module importing grammY and
  the only one that sends anything.
- CONTEXT.md gains one term naming what interpretation produces: everything one Telegram update tells
  Mike-bot about a Chat. The concept is genuinely new to the model, and naming it is what stops the next
  reader inventing a second word for it.
- **This is the one change that adds a seam rather than reusing one.** The expected payoff is that the
  ingestion integration suite loses several hundred lines and that the Stats command and Scoring reply suites
  shrink from dropping their grammY Context scaffolding. The change is kept either way: once it has landed,
  unwinding it costs more than living with a seam that turned out to be merely neutral.

## Testing Decisions

A good test here asserts external behaviour at a module's interface and says nothing about how the module
reaches it. The interface is the test surface: if a test needs to reach past it, the module is the wrong
shape. Existing seams are strongly preferred to new ones, and the highest available seam wins.

### Seams

| Change | Seam tested at | New? |
| --- | --- | --- |
| 1 — supergroup upgrade deleted | the Telegram update handler | existing |
| 2 — one Season rule | the Leaderboard query | existing |
| 3 — one aggregation per period | the Leaderboard query for the annual path; the scoring aggregation for flair and ranking | existing |
| 4 — route guards | the route handlers | existing |
| 5 — interpretation | the update reader | **new** |

### Per change

- **1**: covered by deletion. The upgrade test case goes with the code. The private Stats command gains a
  case asserting that nothing is written and nothing is sent. The three update handlers gain cases asserting
  that a non-supergroup update writes no Message row and no Display identity.
- **2**: tested at the Leaderboard query. Prior art is the existing suite there, which already covers
  grace-window crediting, the Season cutoff, and imported-Mark attribution — those cases are rewritten to the
  new rule rather than deleted, and the imported-Mark case now asserts the Message-post-time attribution
  including the accepted month shift.
- **3**: annual behaviour is tested at the Leaderboard query, because that is where the annual path lives.
  Ranking, flair, ties, and section order stay at the scoring aggregation, which already has the strongest
  suite in the repo. The existing "filters Marks outside the requested Season" case is deleted rather than
  rewritten — that responsibility now belongs to the query.
- **4**: **the guards get no test file of their own.** Their entire observable behaviour is the status code at
  the route, and the route suites already exist. One route carries the full unauthenticated / unparseable /
  unauthorized matrix; the other three assert only what is distinctive about them. This removes the
  duplicated auth cases currently repeated across four route suites without adding a seam beneath one that
  already exists.
- **5**: the ingestion suite splits. The cases asserting that nothing is written — private Chat, ephemeral
  message, bot author, unreadable timestamp, closed Season, uncached Message, Scoring reply not cached —
  become table-driven tests against the update reader with no database, and the originals are deleted rather
  than kept. Keeping both is how a suite reaches 883 lines, and a case covered twice hides a regression in the
  cheap copy behind a pass in the expensive one. The cases asserting ordering and concurrency under a real
  database — Undo window, redelivery, removal-before-addition, same-second tap and untap, concurrent
  duplicates, transaction rollback — stay exactly where they are, against PGlite. Those are where the bugs
  actually live.

### Prior art

Database-backed tests use isolated PGlite per ADR-0008; the existing Mark storage, Leaderboard query, and
ingestion suites are the pattern to follow. Pure aggregation tests follow the existing scoring suite. Route
tests follow the existing route suites.

## Out of Scope

- **The Chat presentation module.** Consolidating the Chat list, the Chat metadata refresh policy, and the
  Chat photo proxy behind one interface is deferred. Its real motivation is the unbounded Telegram `getChat`
  call, already filed at `.scratch/chat-metadata-refresh/issues/01`, and its shape is better decided by
  whoever bounds that call with the constraint in hand.
- **Any change to the v1 import.** The import already writes Message post times from v1 timestamps. Change 2
  depends on that behaviour and does not alter it.
- **Any schema change.** No column is added, removed, or backfilled. In particular, a stored credited-Season
  column was considered and rejected: it solves a provenance branch that the import already dissolves.
- **Restoring plain-group support or the group-to-supergroup upgrade**, in any form.
- **The one-line naming modules** — Member display name, acknowledgement name, Chat label fallback. They fail
  a depth test on paper but deleting them would only move a one-liner to its callers, and each carries a
  distinction that matters.
- **The Mark storage module.** It is the deepest module in the repo and the shape the rest of this work aims
  at. It is not touched.
- **The reaction-diff adapter's behaviour.** Its removal-before-addition ordering is load-bearing and
  unchanged; change 5 absorbs it into interpretation rather than wrapping it.

## Further Notes

Vocabulary: this spec uses CONTEXT.md's domain terms — Mark, Season, Leaderboard period, Scoring action,
Scoring reaction, Scoring reply, Imported Mark, Actor, Subject, Chat, Member, Display identity, Registration,
Undo window, Stats command, Mini App — and the project's architecture vocabulary: module, interface, seam,
depth, leverage, locality, adapter.

On principles: changes 2 and 3 are unambiguous net deletions of duplicated knowledge, and both remove code
guarding states that cannot occur. Change 1 is scope reduction, with one honest cost — a repeated literal
where a predicate used to be, chosen deliberately. Change 4 is a mild win, justified because the duplication
it removes has already drifted into two error vocabularies. Change 5 is the only one that adds a concept, and
it is kept regardless of how much the suites shrink, for the reason given above.

Verification before each commit, per AGENTS.md: format check, lint, typecheck, build, test. Documentation-only
changes need only the format check.

Branch policy: all work on `v2`, committed directly. `master` is live v1 and off limits.
