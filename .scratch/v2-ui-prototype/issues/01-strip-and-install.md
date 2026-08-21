# 01: Strip the pre-prototype and install the dependency set

**What to build:** Clear the ground so every later ticket is easy. The v2-ui prototype still routes and
builds, but everything that fights the new design is gone and everything the new design needs is present.
A developer opening the prototype sees a bare Chat list in the committed arcade palette and typeface, with
no prose styling, no chart, and no dropdown Season navigation anywhere.

This is prefactoring: "make the change easy, then make the easy change."

**Blocked by:** None (can start immediately)

**Status:** resolved

- [ ] The typeset stylesheet is deleted outright: the file itself, its import from the prototype group's
      global stylesheet, and its classes on `<body>`
- [ ] The 8bitcn kitchen-sink routes still build and render after losing prose styling (accepted
      regression, but they must not break)
- [ ] The chart/pulse section component is deleted; no chart of any kind remains in the prototype
- [ ] The two-`<select>` Season navigation component is deleted
- [ ] The desktop two-column leaderboard grid and its table markup are removed
- [ ] A single bespoke stylesheet is created for the prototype and imported exactly once from the
      prototype's layout; nothing is added to the prototype group's global stylesheet
- [ ] The arcade palette already present in the prototype group's stylesheet is the committed look: no
      light mode, no dark mode, no `prefers-color-scheme` handling
- [ ] Press Start 2P is applied as the only typeface at every size; no secondary font family is introduced
- [ ] 8bitcn `carousel`, `drawer`, `toggle-group`, and `xp-bar` are installed via the configured 8bitcn
      registry
- [ ] The motion library is added as a runtime dependency
- [ ] Faker is added as a **devDependency** (it will run server-side only)
- [ ] `empty`, `avatar`, `badge`, `button`, `card`, `item`, `separator`, and `skeleton` are confirmed
      already vendored and are not re-installed
- [ ] The prototype root still redirects to the Chat list and the Chat list still renders
- [ ] `pnpm fmt:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test` all pass with zero
      warnings
- [ ] Lands as a single commit on `v2-user-ui-prototypes`, not pushed

## Comments

**Dependency deviation: vaul is not needed, and neither is Radix.** The spec
planned three new runtime dependencies (embla, vaul, motion). Installing the
8bitcn set against this project's configured registry produced two of them:

- **embla-carousel-react** — as planned, via `@8bitcn/carousel`.
- **motion** — as planned.
- **vaul — not installed.** This project's shadcn style is `base-nova`, so the
  base `drawer`, `toggle-group`, and `progress` components the registry pulled
  in are built on `@base-ui/react`, which is already a dependency. Base UI's
  `Drawer` provides exactly what vaul was argued for — drag-to-dismiss,
  rubber-band resistance, velocity-based dismissal, snap points, and a
  `--drawer-swipe-progress` variable — so hand-rolling was never on the table
  and a second drawer library would have been redundant.

Net: **two** new runtime dependencies rather than three.

**Consequence: three 8bitcn wrappers had to be retargeted.** The registry ships
`8bit/drawer.tsx`, `8bit/toggle-group.tsx`, and `8bit/progress.tsx` written
against vaul and Radix, while the base components it installs alongside them are
Base UI. As shipped, `8bit/drawer.tsx` rendered a vaul `Content` inside a Base UI
`Root` — broken at runtime, not merely at typecheck. All three wrappers were
retargeted to the Base UI primitives that back the base components. The 8bit
skin (pixel borders, `retro` class, `variant="retro"` square-segment bar) is
unchanged, and `xp-bar` consumes `8bit/progress` through its original API.

`@base-ui/react`'s `progress` base component was installed to complete the set.

**Vendored lint fixes.** The registry's carousel files tripped the repo's lint
gate (`set-state-in-effect`, unnecessary optional chains, `type` vs `interface`)
and shipped two stray `console.log` calls in `scrollPrev`/`scrollNext`. Fixed in
place. `components/ui/button.tsx` and `8bit/styles/retro.css` were overwritten by
the installer and reverted — `retro.css` deliberately keeps its Google Fonts
import and `font-family` commented out, since Press Start 2P is loaded through
`next/font`.

**Palette.** The prototype group's stylesheet had a light `:root` palette and a
`.dark` override. The arcade values were promoted to `:root` and the `.dark`
block deleted, so there is one committed look and no mode switching. The `dark`
class stays on `<html>` because the vendored 8bitcn components use `dark:`
variants for their pixel borders; it now selects nothing but itself.

**Typeface.** `--font-sans`/`--font-serif`/`--font-mono` pointed at VT323, a
second family. All three now point at Press Start 2P, applied to `<body>` through
`next/font`'s generated class rather than through the group stylesheet, so
nothing was added there.
