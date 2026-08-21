# 02: Deterministic fixtures rendered through Chat-scoped routes

**What to build:** A Member can reach any Chat's Leaderboard for any Season by URL and see that Season's
five sections filled with believable, stable data. The sections render as plain unstyled lists at this
stage — this ticket is about the data being real, correctly Chat-scoped, and correctly Season-scoped, not
about how it looks.

Per ADR 0009 everything is Chat-scoped, so the Chat is part of the URL: Chat id, then year, then an
optional month. A month-less URL is the full-year view. A Leaderboard URL with no Season at all redirects
to the Current Season.

**Blocked by:** 01

**Status:** ready-for-agent

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
