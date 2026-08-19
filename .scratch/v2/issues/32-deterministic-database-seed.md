# 32 — Move fixtures behind deterministic `db:seed`

**Parent:** [v2 spec](../spec.md)

**What to build:** Give developers one explicit command that resets and populates a useful local database while making every ordinary Chat-picker and leaderboard request read-only. Repeated seed runs must produce the same registered, unregistered, and forbidden Member scenarios with Events in currently useful Moscow Seasons.

**Blocked by:** [31 — Simplify script environment loading and enforce warning-free lint](31-simple-script-env-and-warning-free-lint.md)

**Status:** ready-for-agent

- [ ] A separate `db:seed` package command uses official Drizzle Seed reset-and-seed behavior and updates the package manifest and lockfile together.
- [ ] The default target is file-backed local PGlite shared with the local application runtime; its location can be configured explicitly.
- [ ] Remote PostgreSQL reset is refused unless `ALLOW_REMOTE_DATABASE_SEED=1` is set, and an allowed remote run prints a prominent destructive reset warning before changing data.
- [ ] A fixed generator seed and refinements produce deterministic Chats, Members, registrations, and scoring Events, including known registered, unregistered, and forbidden personas.
- [ ] Fixture timestamps are relative to the current `Europe/Moscow` Season and include useful historical Season coverage rather than fixed August 2026 dates.
- [ ] Running the seed twice returns the target to the same fixture instead of accumulating rows.
- [ ] Chat-picker and leaderboard requests never invoke fixture seeding or create fixture rows.
- [ ] PGlite integration tests cover reset repeatability, Season placement, safe target selection, and read-only API behavior.
