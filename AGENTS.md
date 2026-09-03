## Branch policy

- **`master` is off limits.** It is live v1 (the AWS-hosted Telegram bot). Do not commit to it, open PRs into it, or merge into it.
- **All work happens on `v2`.** Commit directly to `v2`. No change-PR-merge loop.
- When v2 is operational, v1 will be declared dead and `master` will be updated in a single cutover.
- **`apps/web` is frozen read-only.** Do not edit, lint, typecheck, test, format, or build it. It is not a workspace package.

## Agent skills

### Issue tracker

Issues live as markdown files under `.scratch/<feature>/` in this repo. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) map 1:1 onto tracker labels. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` plus `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Verification

Before you commit your changes, you must verify your work using the following scripts: `pnpm fmt:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`. You must fix all errors and warnings that occur during those runs, before committing. One exception: when your changes only touch .md files, the only required verification command is `pnpm fmt:check`.
