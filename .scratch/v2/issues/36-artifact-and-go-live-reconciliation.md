# 36 — Reconcile artifacts and finalize the go-live guide

**Parent:** [v2 spec](../spec.md)

**What to build:** Leave the `v2` branch with one truthful description of the implemented system and one complete human go-live checklist. Superseded decisions must be removed rather than preserved as historical amendments, and generated or dependency artifacts must agree with the final code.

**Blocked by:** [35 — Provide faithful signed TMA development personas](35-signed-tma-development-personas.md)

**Status:** ready-for-agent

- [ ] The map, specification, retained tickets, research, ADRs, domain model, code comments, tests, and user-visible copy contain no stale claims about unsigned auth, mutually exclusive Karma, Registration-message pinning, automatic request seeding, retained v1 source, or completed production deployment.
- [ ] Obsolete historical material is deleted aggressively; retained artifacts describe current behavior directly instead of accumulating reconciliation notes.
- [ ] **Registration message** is used consistently, and Telegram pinning is neither performed nor implied.
- [ ] The map points to the actual frontier and accurately distinguishes completed agent work from the user's remaining human work.
- [ ] The README is the sole human go-live checklist and covers web-workspace env files, migrations, optional v1 import, Vercel variables and deployment, webhook registration, BotFather Menu Button setup, group administration/privacy requirements, `/register`, Member registration, verification, and common failures.
- [ ] No human-only ticket is created, v1 runtime source remains absent from `v2`, and the still-relevant one-shot v1 import remains documented.
- [ ] Package manifests, lockfile, database artifacts, and documentation agree with the final implementation.
- [ ] Formatting, zero-warning lint, typecheck, build, and the full test suite all pass.
