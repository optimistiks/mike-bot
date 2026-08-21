# 05: Season picker drawer

**What to build:** A Member taps the Season shown in the header, a bottom drawer rises, and they reach any
Season in one more tap — any month of any year, the whole year, or straight back to the Current Season.
Dragging the drawer down dismisses it with resistance and release rather than a binary snap. Seasons that
hold no data are visibly dimmed, so nobody taps into an empty screen by accident.

A Season that genuinely has no Events shows a single clear empty state rather than five blank sections.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] The Season chip in the header opens the drawer
- [ ] The drawer is built on the 8bitcn `drawer` (vaul). Drag-to-dismiss, rubber-band resistance, and
      velocity dismissal come from the library — **do not hand-roll them**
- [ ] The drawer contains a horizontal year strip above a 3×4 month grid, built with 8bitcn `toggle-group`
      rather than raw buttons or native selects
- [ ] A persistent "СЕЙЧАС" cell returns to the Current Season from anywhere
- [ ] A persistent "ВЕСЬ ГОД" cell opens the month-less full-year view
- [ ] Months with no data render dimmed
- [ ] Selecting any Season navigates with replace and closes the drawer
- [ ] A Season with no Events renders the already-vendored 8bitcn `empty` state, not five blank sections
- [ ] The empty state is reachable in practice: any Season before 2024-01 reaches it
- [ ] Full-year totals shown match the sum of that year's months
- [ ] The drawer and its contents are isolated composed components in their own files
- [ ] Full verification suite green; lands as a single unpushed commit
