# 08: Write the implementation-ready specification and tickets

Type: task
Status: open
Blocked by: 01, 02, 03, 04, 05, 06, 07, 10, 11, 12

## Question

Synthesize the resolved map into a concise specification and an ordered set of implementation tickets for the
new monorepo Hono app. Each ticket must have an observable outcome, explicit dependencies, copied source
references where relevant, and verification criteria.

Keep the settled exclusions explicit: no Mini App changes, no Registration flow, no shared package extraction,
no backwards-compatible cutover, no second `/stats` path, and no production-hardening programme.

## Done when

- A developer can implement the destination without reopening product questions.
- The tickets cover scaffolding, copied ingestion/domain/database code, normalized imported
  `message_authors`, the agent/database boundary, Telegram reports, the direct development Stats harness,
  PGlite-powered tests, webhook setup, Vercel deployment configuration, and every human infrastructure
  handoff needed to operate the bot.
- Automated implementation and verification consume no AI Gateway credit; the first real-model checks are
  explicit human-run steps after infrastructure provisioning.
- Human-only tickets state exactly when work must pause for credentials or dashboard actions, what the human
  provides, where it is configured, and how the agent verifies it afterward without exposing secrets.
- No ticket quietly expands the toy into a production migration project.
