# 01: Strip the pre-prototype and install the dependency set

**What to build:** Clear the ground so every later ticket is easy. The v2-ui prototype still routes and
builds, but everything that fights the new design is gone and everything the new design needs is present.
A developer opening the prototype sees a bare Chat list in the committed arcade palette and typeface, with
no prose styling, no chart, and no dropdown Season navigation anywhere.

This is prefactoring: "make the change easy, then make the easy change."

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

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
