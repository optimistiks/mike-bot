# 32 — Move fixtures behind deterministic `db:seed`

> Historical record: this resolved ticket is not canonical current-state documentation. Its question, answer, and acceptance criteria may now be false; use the Wayfinder map and specification for current behavior.

**Parent:** [v2 spec](../spec.md)

**What to build:** Give developers one explicit command that resets and populates a useful local database while making every ordinary Chat-picker and leaderboard request read-only. Repeated seed runs must produce the same registered, unregistered, and forbidden Member scenarios with Events in currently useful Moscow Seasons.

**Blocked by:** [31 — Simplify script environment loading and enforce warning-free lint](31-simple-script-env-and-warning-free-lint.md)

**Status:** resolved

- [x] A separate `db:seed` package command uses official Drizzle Seed reset-and-seed behavior and updates the package manifest and lockfile together.
- [x] The default target is file-backed local PGlite shared with the local application runtime; its location can be configured explicitly.
- [x] Remote PostgreSQL reset is refused unless `ALLOW_REMOTE_DATABASE_SEED=1` is set, and an allowed remote run prints a prominent destructive reset warning before changing data.
- [x] A fixed generator seed and refinements produce deterministic Chats, Members, registrations, and scoring Events, including known registered, unregistered, and forbidden personas.
- [x] Fixture timestamps are relative to the current `Europe/Moscow` Season and include useful historical Season coverage rather than fixed August 2026 dates.
- [x] Running the seed twice returns the target to the same fixture instead of accumulating rows.
- [x] Chat-picker and leaderboard requests never invoke fixture seeding or create fixture rows.
- [x] PGlite integration tests cover reset repeatability, Season placement, safe target selection, and read-only API behavior.

## Answer

`pnpm db:seed` now migrates, resets through Drizzle Seed, and populates the file-backed PGlite database shared with local runtime. A fixed generator seed produces known registered, unregistered, and forbidden personas plus scoring Events in the current and previous Moscow Seasons. `--remote` requires `ALLOW_REMOTE_DATABASE_SEED=1`, prefers the unpooled URL, and warns before opening PostgreSQL. Request-time seeding and its fixed-August fixture were deleted; PGlite integration tests cover target safety, repeatability, Season placement, and read-only APIs. The manifest and lockfile include `drizzle-seed` together.
