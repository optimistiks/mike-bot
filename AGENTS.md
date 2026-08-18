## Branch policy

- **`master` is off limits.** It is live v1 (the AWS-hosted Telegram bot). Do not commit to it, open PRs into it, or merge into it.
- **All work happens on `v2`.** Commit directly to `v2`. No change-PR-merge loop.
- When v2 is operational, v1 will be declared dead and `master` will be updated in a single cutover.

## Agent skills

### Issue tracker

Issues live as markdown files under `.scratch/<feature>/` in this repo. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) map 1:1 onto tracker labels. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` plus `docs/adr/` at the repo root. See `docs/agents/domain.md`.
