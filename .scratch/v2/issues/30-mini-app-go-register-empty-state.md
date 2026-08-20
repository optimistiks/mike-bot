# 30 — Mini App «go register» empty state

> Historical record: this resolved ticket is not canonical current-state documentation. Its question, answer, and acceptance criteria may now be false; use the Wayfinder map and specification for current behavior.

**Parent:** [v2 spec](../spec.md)

**What to build:** Replace the ticket 20/25 «Нет общих чатов с ботом» empty state with registration-specific Russian copy: prompt to react to a Registration message and ask a group admin to run `/register`. When the opener has one or more `chat_memberships` rows, show the normal Chat picker and leaderboard flow unchanged. Unregistered Members see the prompt only — no leaderboard sections.

**Blocked by:** [29 — Explicit registration](29-explicit-registration-flow.md)

**Status:** resolved

## Answer

Replaced the join-sync empty state («Нет общих чатов с ботом») with Russian registration copy in `lib/mini-app/copy.ts` and `mini-app-client.tsx`. Fixture seed registers only the default dev opener (`FIXTURE_USER_ID`) in `chat_memberships`. Added API test for unregistered opener returning `{ chats: [] }` and copy unit tests.
