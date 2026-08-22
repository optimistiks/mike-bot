# 09: Refine carousel usability and leaderboard hierarchy

Type: task
Status: resolved

## What to change

- Upgrade the prototype to `embla-carousel-react@9.0.0-rc03` and use `dragFree: "snap"`.
- Use the existing 8bitcn previous/next arrows as primary navigation on fine-pointer devices; keep them
  half-transparent at rest and opaque on hover or keyboard focus.
- Keep touch navigation direct and hide duplicate arrows on touch-only devices.
- Remove the carousel-position strip and per-entry score bars without replacing either one.
- Keep standing cards mounted across carousel selection changes; replay only the staggered score count-up.
- Increase the neighbouring-content peek to 32–40px and give standing cards a subtle violet surface.
- Make the CRT boot beam expand to the whole viewport.

## Acceptance

- [x] A released drag carries momentum and settles at the nearest snap under Embla RC3.
- [x] Standing cards do not disappear and reappear when the selected section changes.
- [x] Desktop arrows are visible at rest, become opaque on hover/focus, and navigate correctly.
- [x] Touch-only viewports do not show the desktop arrows.
- [x] The next section reads as real neighbouring content without a separate carousel indicator.
- [x] Avatar, Display identity, and score dominate each standing card; no progress bars remain.
- [x] The CRT boot beam covers the viewport at full expansion.
- [x] The focused regression test and repository verification pass, with the accepted Turbopack sandbox
      exception recorded below.

## Comments

This iteration records decisions reached in the follow-up grilling session. It changes the current
prototype in place; no alternate prototype is created.

## Answer

Pinned Embla React to `9.0.0-rc03`, migrated the vendored 8bitcn wrapper to the v9 API, and enabled
`dragFree: "snap"` on the existing filmstrip. A low-level mouse run measured the track continuing from
`-663px` immediately after release through `-901px` and `-1090px`, then settling at the `-1240px` snap.
Fine-pointer viewports render the existing pixel arrows at 48% opacity (100% on hover/focus); the CSS
media query omits them when hover and a fine pointer are unavailable.

Standing cards now keep stable DOM identity while only their score counters remount. The header position
strip, per-card progress bars, and their motion configuration were removed. Cards received a quiet violet
surface, while the filmstrip exposes 32px of the next real card at a 320px viewport and 40px on desktop.
The CRT beam measured exactly 390×844 at its full-expansion keyframe in a 390×844 viewport.

The focused no-remount browser regression passes. `pnpm fmt:check`, `pnpm lint`, `pnpm typecheck`, and
`pnpm test` pass; the latter ran 137 unit/integration tests and 7 Chromium tests. Next devtools reported no
compilation or runtime errors, and `next build --webpack` completed every route. The exact Turbopack build
was attempted elevated but its PostCSS worker was denied permission to bind an internal port by the host
environment; the developer explicitly accepted that environment-only exception.
