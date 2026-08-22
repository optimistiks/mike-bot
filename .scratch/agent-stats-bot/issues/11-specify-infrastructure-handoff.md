# 11: Specify the human infrastructure handoff

Type: prototype
Status: open
Blocked by: 02, 04, 05, 06, 07, 10

## Question

Which external resources, credentials, and dashboard actions must the human provide during implementation,
and at what exact point does each handoff occur? Produce an implementation-ready runbook without creating
projects or requesting real secrets during Wayfinding.

The runbook must cover:

- creating or selecting the Vercel project for the Hono workspace and setting its root/build configuration;
- creating or selecting the Neon database, applying migrations, and running any required import/backfill;
- providing the operational database URL and a distinct direct, unpooled primary URL for the agent's
  transaction-local staging, with their environment variable names and Vercel Local/Preview/Production
  scope;
- supplying Telegram bot credentials and webhook secret, registering and verifying the webhook with the
  required updates, and disabling the Mini App button in BotFather;
- configuring Vercel AI Gateway authentication/model variables and any development-harness switch or secret;
- deploying and running deterministic verification without contacting a real model;
- handing the configured Postman and real-group smoke checks to the human only after every required service,
  database connection, and AI credential is present—the agent provides the exact requests but does not send
  them;
- distinguishing actions the implementation agent can run from dashboard/credential actions that require
  the human, including the exact evidence needed before work resumes.

Whether the Neon project is new or existing is not a product decision. The required contract is one
operational connection and one separate direct agent connection with the capabilities established by
[Prove the SQL and Chat-isolation boundary](04-prove-sql-boundary.md).

## Done when

- Every required environment variable has an owner, source, destination environment, and verification method.
- The runbook has no vague “configure Vercel/Neon/Telegram” steps.
- An implementation session can pause for human input and resume without asking the human to rediscover what
  value or dashboard action is needed.
- The first AI Gateway request and every live-model smoke check are explicitly human-triggered; no agent-run
  verification spends the monthly credit.
- No credential value is stored in the repository or the Wayfinder artifacts.
