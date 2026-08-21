# 02: Deterministic fixtures rendered through Chat-scoped routes

**What to build:** A Member can reach any Chat's Leaderboard for any Season by URL and see that Season's
five sections filled with believable, stable data. The sections render as plain unstyled lists at this
stage — this ticket is about the data being real, correctly Chat-scoped, and correctly Season-scoped, not
about how it looks.

Per ADR 0009 everything is Chat-scoped, so the Chat is part of the URL: Chat id, then year, then an
optional month. A month-less URL is the full-year view. A Leaderboard URL with no Season at all redirects
to the Current Season.

**Blocked by:** 01

**Status:** resolved

- [ ] Fixture data is generated **on the server** and passed to client components as plain arrays; faker
      never appears in the browser bundle
- [ ] Fixture output uses the **same shape as the production `LeaderboardResponse`** already defined in the
      leaderboard schema module, so components could later be pointed at the real endpoint unchanged
- [ ] Data is seeded and deterministic: reloading the same URL twice produces identical standings
- [ ] Four Chats exist with **hand-written Russian names**, one of them deliberately long enough to stress
      the header; faker's ru locale is not used anywhere
- [ ] Each Chat has a roster of roughly 12 Members that is **fixed across Seasons** — the same people
      appear every month
- [ ] Display identities render as Telegram `@handle`-style strings, including at least one of ~25
      characters
- [ ] Scores are reseeded per year and month so ranks, Crowns, and Chickens move between Seasons
- [ ] At least one section in at least one Season has a **multi-way Crown tie**, since Crown is
      tie-inclusive per the domain glossary
- [ ] Chicken only appears where at least one Member has a strictly higher total
- [ ] A year's totals equal the **sum of that year's months** — the two views never contradict each other
- [ ] No Season before 2024-01 has any data
- [ ] Routes are Chat-scoped: Chat id, then year, then optional month
- [ ] A Leaderboard URL without a Season redirects to the Current Season's year and month
- [ ] Season changes navigate with **replace**, not push, so back always returns to the Chat list rather
      than walking back through previously viewed Seasons
- [ ] All five sections render in the fixed order: Уважаемые люди, Юмористы, На позитиве, Хотят смеяться
      5 минут, Как же у них горит
- [ ] Production's scoring module section titles are **not** modified
- [ ] Full verification suite green; lands as a single unpushed commit

## Comments

**The fixture builder runs production's own aggregation.** Rather than
reimplementing ranking, Crown, and Chicken, the builder generates seeded
`ScoringEvent`s and feeds them to `aggregateLeaderboard` from the scoring
module, then maps the result onto the prototype's section titles and order the
same way `queryLeaderboard` maps it onto display identities. Crown stays
tie-inclusive and Chicken stays conditional on someone being strictly higher
because production decides both — the prototype never restates the rules.

**A year is the sum of its months by construction.** The full-year view
concatenates the year's Events and credits them to a single Season, so the same
aggregation that ranks a month ranks the year. There is no separate summing path
that could drift.

Verified in the running app against Chat `-1001000000001`:

- Every entry in the 2024 full-year view equals the sum of that member's twelve
  monthly scores — zero mismatches across all five sections.
- Loading the same Season URL twice produces byte-identical standings.
- Every Season before 2024-01 renders zero entries in all five sections.
- The roster is identical in 2024-05 and 2025-11 for both the first and the
  long-named Chat: 12 members each.
- The longest handle is 30-31 characters in every Chat
  (`@jose.altenwerth24_sonny_auer46`), past the ~25 the ticket asked for.

**Multi-way Crown ties.** Ties turned out to be common at this event volume, but
"common" is not "guaranteed", so March of every year is deliberately arranged to
have one: the Юмористы runner-up is lifted to the leader's total with real Humor
Marks, and production's aggregation awards both Crowns. 2024-03 shows two Crowns
in Юмористы in every Chat.

**Route shape.** `chats/[chatId]/leaderboards/[year]/[month]`, with the
month-less URL as the full-year view and the Season-less URL redirecting to the
Current Season. The old `leaderboards/*` tree is deleted.

**Season navigation is a placeholder.** Ticket 05 replaces `season-links.tsx`
with the drawer. What it establishes now is the navigation semantics the drawer
inherits: every Season link carries `replace`, so back returns to the Chat list
in one press rather than walking through previously viewed Seasons.

**Event volume.** The first pass generated 120-280 Events per Season, which put
top scores in the single digits and filtered several members out of each section
as zero. Raised to 600-1400, which puts Karma received in the 10-60 range for a
month and the low hundreds for a year — enough to give the score bar and the
count-up spring something to do in ticket 06.
