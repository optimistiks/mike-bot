# 10: Specify the direct development Stats harness

Type: prototype
Status: open
Blocked by: 02, 04, 05

## Question

What is the smallest development-only Hono endpoint that lets a human send a Stats question directly from
Postman, without constructing a Telegram update, while exercising the exact agent and SQL-tool pipeline used
by `/stats`?

The contract must include:

- an explicit trusted `chatId` alongside free-form question text, because Chat scope cannot come from
  Telegram in this adapter;
- one request and response schema suitable for quick Postman use;
- behavior for an empty question and for agent/tool failures;
- whether the endpoint is available only under the local dev server or also on Vercel Preview deployments,
  and the minimal switch or protection that keeps it unavailable in production;
- how a local run selects PGlite or Neon and invokes the configured Vercel AI Gateway model;
- how the same endpoint uses an injected deterministic model during automated tests while making a real-model
  request only when the human deliberately starts and calls the live configuration;
- a runnable local command and one copy-paste request example.

The endpoint is a development transport adapter, not a second Stats implementation. Telegram and this
endpoint must call the same transport-independent function defined by
[Specify the agent and tool contract](05-specify-agent-contract.md).

## Done when

- A developer can start the Hono app locally and submit a question such as “give me stats for last month”
  from Postman without Telegram.
- The same harness can exercise the chosen Vercel model, with its environment requirements explicit.
- Its automated tests cannot reach AI Gateway or consume credit.
- The contract makes accidental production exposure an explicit, testable condition.
