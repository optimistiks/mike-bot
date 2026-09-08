## Branch policy

- **`master` is off limits.** It is live v1 (the AWS-hosted Telegram bot). Do not commit to it, open PRs into it, or merge into it.
- **All work happens on `v2`.** Commit directly to `v2`. No change-PR-merge loop.
- When v2 is operational, v1 will be declared dead and `master` will be updated in a single cutover.

## Agent skills

### Verification

Before you commit your changes,

- you must verify your work using the following scripts: `pnpm install`, `pnpm fmt:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`,
- you must fix all errors and warnings that occur during those runs, before committing.

One exception: when your changes only touch .md files, the only required verification command is `pnpm fmt:check`.
