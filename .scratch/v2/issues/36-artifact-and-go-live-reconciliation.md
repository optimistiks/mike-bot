# 36 — Reconcile artifacts and finalize the go-live guide

> Historical record: this resolved ticket is not canonical current-state documentation. Its question, answer, and acceptance criteria may now be false; use the Wayfinder map and specification for current behavior.

**Parent:** [v2 spec](../spec.md)

**What to build:** Leave the `v2` branch with one truthful description of the implemented system and one complete human go-live checklist. Superseded decisions must be removed rather than preserved as historical amendments, and generated or dependency artifacts must agree with the final code.

**Blocked by:** [35 — Provide faithful signed TMA development personas](35-signed-tma-development-personas.md)

**Status:** resolved

- [x] The map, specification, research, ADRs, domain model, code comments, tests, and user-visible copy describe signed authentication, independent Karma reactions, ordinary Registration messages, explicit request-free seeding, absent v1 runtime source, and production deployment as remaining human work.
- [x] Every resolved ticket is visibly marked as historical and non-canonical so superseded questions, answers, and acceptance criteria are not read as current behavior.
- [x] **Registration message** is used consistently in every current and historical project artifact.
- [x] The map keeps its Destination aspirational and points to the actual human frontier required to reach it.
- [x] The README is the authoritative detailed human go-live checklist and covers web-workspace env files, migrations, v1 import, Vercel variables and deployment, webhook registration, BotFather Menu Button setup, group administration/privacy requirements, `/register`, Member registration, verification, and common failures.
- [x] A `ready-for-human` ticket closes the gap from agent-ready branch to the Wayfinder Destination without duplicating the README's detailed procedure.
- [x] v1 runtime source remains absent from `v2`, and the still-relevant one-shot v1 import remains documented.
- [x] Duplicate Telegram updates, including `/register`, are claimed before their effects and do not repeat successful command side effects.
- [x] Package manifests, lockfile, database artifacts, and documentation agree with the final implementation.
- [x] Formatting, zero-warning lint, typecheck, build, and the full test suite all pass.

## Answer

Canonical artifacts now describe the hardened implementation directly while every resolved ticket carries a historical, non-canonical warning. Registration-message terminology is consistent across the repository. The map preserves its aspirational Destination and identifies [Put v2 live on Vercel and Telegram](37-put-v2-live-on-vercel-and-telegram.md) as the sole human frontier, with the README remaining the authoritative detailed checklist.

Telegram update claiming now encloses `/register` command processing as well as ordinary message, reaction, and membership effects. A composed-bot regression test proves that retrying one successful `/register` update does not repeat Telegram API calls or Registration-message persistence. Formatting, zero-warning lint, typecheck, production build, 124 Node tests, and 6 Chromium tests pass.
