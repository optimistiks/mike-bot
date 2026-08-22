# 08: Integrate and verify the whole prototype

**What to build:** Nothing new. Walk the finished prototype end to end at a mobile viewport, confirm every
screen and edge case the spec promised actually renders, and confirm the constraints held across all seven
preceding tickets rather than only within each one.

**Blocked by:** 01, 02, 03, 04, 05, 06, 07

**Status:** ready-for-agent

### Walkthrough (browser automation at mobile viewport, plus the Next devtools MCP)

- [ ] Chat list, including the deliberately long Chat name
- [ ] Chat card → Leaderboard header morph
- [ ] All five sections reached by swiping, in the fixed order
- [ ] A ~25-character `@handle` wrapping without truncation
- [ ] A multi-way Crown tie rendering multiple crowns
- [ ] "показать всех" expanding a long section
- [ ] Season drawer: year strip, month grid, ВЕСЬ ГОД, СЕЙЧАС, dimmed months, drag to dismiss
- [ ] A full-year Season, with totals matching the sum of its months
- [ ] An empty Season (pre-2024) showing the empty state
- [ ] CRT boot, scanlines, and the tracking-glitch wipe on Season change
- [ ] Back button behaviour: closes drawer when open, returns to Chat list otherwise, in one press after
      multiple Season changes

### Cross-cutting constraint audit

- [ ] All bespoke CSS lives in the prototype's single stylesheet; nothing leaked into the prototype group's
      global stylesheet or into scattered component files
- [ ] No functional primitives were hand-built where an 8bitcn component exists
- [ ] Every component authored for this prototype is a meaningful isolated file; no div soup in pages
- [ ] No chart, sparkline, or pulse visualisation exists anywhere in the prototype
- [ ] The typeset stylesheet is gone and the 8bitcn kitchen-sink routes still build
- [ ] Production code — scoring module, leaderboard API, database, bot, production Mini App — is untouched
- [ ] Faker does not appear in the browser bundle
- [ ] Any fallback taken during implementation (xp-bar → progress, full-card morph → avatar-only morph,
      carousel → stacked snap-scroll) is recorded in a comment on the relevant ticket

### Final state

- [ ] `pnpm fmt:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test` all pass with zero
      warnings
- [ ] No automated tests were added — this is a throwaway prototype by design
- [ ] Lands as a single unpushed commit on `v2`
- [ ] Any decision that hit the stop-and-raise rule is surfaced to the developer rather than silently
      resolved
