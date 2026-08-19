# 31 — Simplify script environment loading and enforce warning-free lint

**Parent:** [v2 spec](../spec.md)

**What to build:** Make every developer and operator command use one obvious environment convention and make a successful lint run guarantee zero warnings. Migration, import, and webhook setup must keep their existing behavior without a custom environment-loading abstraction.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Drizzle configuration and operational scripts call dotenv directly with `.env.local` before `.env`; the custom environment-file loader is deleted.
- [ ] Database migration and import commands prefer `DATABASE_URL_UNPOOLED` and fall back to `DATABASE_URL` without a shared resolver abstraction.
- [ ] Documentation establishes the web workspace as the working directory for script environment files and commands.
- [ ] Both lint and lint-fix fail when ESLint reports any warning.
- [ ] The repository has no lint warnings, and every required verification command passes.
