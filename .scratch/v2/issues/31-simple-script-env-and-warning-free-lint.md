# 31 — Simplify script environment loading and enforce warning-free lint

> Historical record: this resolved ticket is not canonical current-state documentation. Its question, answer, and acceptance criteria may now be false; use the Wayfinder map and specification for current behavior.

**Parent:** [v2 spec](../spec.md)

**What to build:** Make every developer and operator command use one obvious environment convention and make a successful lint run guarantee zero warnings. Migration, import, and webhook setup must keep their existing behavior without a custom environment-loading abstraction.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] Drizzle configuration and operational scripts call dotenv directly with `.env.local` before `.env`; the custom environment-file loader is deleted.
- [x] Database migration and import commands prefer `DATABASE_URL_UNPOOLED` and fall back to `DATABASE_URL` without a shared resolver abstraction.
- [x] Documentation establishes the web workspace as the working directory for script environment files and commands.
- [x] Both lint and lint-fix fail when ESLint reports any warning.
- [x] The repository has no lint warnings, and every required verification command passes.

## Answer

Drizzle configuration, v1 import, and webhook setup now call dotenv directly with `.env.local` before `.env` from the `apps/web` working directory. Migration and import select `DATABASE_URL_UNPOOLED` before `DATABASE_URL` inline, the custom loader has been deleted, and the README/database guide consistently document workspace-local commands and environment files. Both web lint scripts enforce `--max-warnings=0`; all repository verification gates pass without warnings.
