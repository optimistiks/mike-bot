# 08: Integrate and verify the whole prototype

**What to build:** Nothing new. Walk the finished prototype end to end at a mobile viewport, confirm every
screen and edge case the spec promised actually renders, and confirm the constraints held across all seven
preceding tickets rather than only within each one.

**Blocked by:** 01, 02, 03, 04, 05, 06, 07

**Status:** resolved

### Walkthrough (browser automation at mobile viewport, plus the Next devtools MCP)

- [x] Chat list, including the deliberately long Chat name
- [x] Chat card → Leaderboard header morph
- [x] All five sections reached by swiping, in the fixed order
- [x] A ~25-character `@handle` wrapping without truncation
- [x] A multi-way Crown tie rendering multiple crowns
- [x] "показать всех" expanding a long section
- [x] Season drawer: year strip, month grid, ВЕСЬ ГОД, СЕЙЧАС, dimmed months, drag to dismiss
- [x] A full-year Season, with totals matching the sum of its months
- [x] An empty Season (pre-2024) showing the empty state
- [x] CRT boot, scanlines, and the tracking-glitch wipe on Season change
- [x] Back button behaviour: closes drawer when open, returns to Chat list otherwise, in one press after
      multiple Season changes

### Cross-cutting constraint audit

- [x] All bespoke CSS lives in the prototype's single stylesheet; nothing leaked into the prototype group's
      global stylesheet or into scattered component files
- [x] No functional primitives were hand-built where an 8bitcn component exists
- [x] Every component authored for this prototype is a meaningful isolated file; no div soup in pages
- [x] No chart, sparkline, or pulse visualisation exists anywhere in the prototype
- [x] The typeset stylesheet is gone and the 8bitcn kitchen-sink routes still build
- [x] Production code — scoring module, leaderboard API, database, bot, production Mini App — is untouched
- [x] Faker does not appear in the browser bundle
- [x] Any fallback taken during implementation (xp-bar → progress, full-card morph → avatar-only morph,
      carousel → stacked snap-scroll) is recorded in a comment on the relevant ticket

### Final state

- [x] `pnpm fmt:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test` all pass with zero
      warnings
- [x] No automated tests were added — this is a throwaway prototype by design
- [x] Lands as a single unpushed commit on `v2`
- [x] Any decision that hit the stop-and-raise rule is surfaced to the developer rather than silently
      resolved

## Answer

Walked the prototype end to end in headed Chrome via agent-browser 0.34.0 at 390×844 and the 320×640
narrow-phone boundary, with Next.js 16.3.1's `/_next/mcp` as the framework-side cross-check. The Chat list,
shared-card morph, fixed-order non-looping carousel, long Display identity wrap, March 2024 Crown tie,
standings reveal, Season drawer and drag dismissal, full-year destination, pre-2024 empty state, CRT
boot/skip, scanlines, Season glitch, and native Back Button behavior all rendered and behaved as specified.
The Telegram development bridge emitted the expected Chat-impact, carousel/Season-selection, and
Crown-success haptics. Its initialization emitted `web_app_expand`, disabled vertical swipe, requested both
safe-area families, bound the stable-height and inset CSS variables, and set the header and bottom bar to
`#100c18`. A fresh production-browser session with no Telegram globals still navigated from the Chat list
to a Leaderboard and opened the Season drawer without console or runtime errors.

The cross-cutting audit found one prototype stylesheet imported once, 22 isolated components, no
prototype chart/select/typeset remnants, no production-module diff since the implementation baseline, and
the recorded `xp-bar` → `progress` fallback in ticket 03. The `/8bitcn/kitchen-sink` route also rendered
its blocks and components in the browser without console or runtime errors after typeset removal. An
uncached production build contains no Faker symbols in `.next/static`. A one-off server-side reconciliation
for Chat `-1001000000004` found zero score mismatches between the 2024 full-year view and all twelve monthly
views across five sections and twelve Members.

Next MCP finished with no compilation, configuration, or browser-session errors. `pnpm fmt:check`,
`pnpm lint`, `pnpm typecheck`, an uncached `pnpm build --force`, and an uncached `pnpm test --force` all
passed; the suite contains 137 unit/integration tests and 6 Chromium tests. No automated tests were added
for this ticket, and no stop-and-raise decision was encountered.
