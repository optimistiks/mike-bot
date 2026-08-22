# 07: Specify verification boundaries

Type: prototype
Status: open
Blocked by: 04, 05, 06, 10, 12

## Question

Define proportionate verification for this experiment. Automated tests should cover deterministic contracts:
reaction ingestion parity, disposable SQL-snapshot isolation, prompt/tool schema assembly, Telegram escaping
and chunking, and update routing. They must not require an exact SQL string or prose response from a live
model.

The new Hono app must copy the current app's PGlite-backed testing machinery closely enough that database,
import, ingestion, stats-tool, and direct-development-endpoint tests run locally without Neon credentials.
Define the fixture/seed boundary and which tests exercise the full Hono request path against PGlite.

All automated pipeline tests must inject a deterministic model double with scripted tool calls and final
output. They may verify prompt assembly, tool-loop orchestration, tool results, retries, and renderer input,
but must never contact AI Gateway or require an AI credential.

Define a tiny live-model smoke set for the human to run only after the infrastructure handoff is complete.
Judge semantic facts against known data while accepting different valid SQL and wording. It is not a CI gate,
and an implementation agent must not execute it or otherwise spend the human's AI Gateway credit.

## Done when

- The answer maps each risk to a deterministic automated check or an explicitly optional observation.
- Cross-Chat queries return no rows because only the invoking Chat was projected; mutations affect only the
  disposable PGlite copy and leave the source database unchanged.
- PGlite-backed tests cover the retained database behavior and the direct Hono development endpoint without
  requiring Telegram or Neon.
- The automated suite fails closed if it would contact a real model, and needs no `AI_GATEWAY_API_KEY` or
  Vercel OIDC token.
- Live-model verification is a clearly labelled human action that occurs only after provisioning.
- The repository's required verification commands remain the final implementation gate.
