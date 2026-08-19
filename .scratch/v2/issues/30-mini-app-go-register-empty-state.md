# 30 — Mini App «go register» empty state

**Parent:** [v2 spec](../spec.md)

**What to build:** Replace the ticket 20/25 «Нет общих чатов с ботом» empty state with registration-specific Russian copy: prompt to react to the registration pin and ask a group admin to run `/register`. When the opener has one or more `chat_memberships` rows, show the normal chat picker and leaderboard flow unchanged. Unregistered users see the prompt only — no leaderboard sections.

**Blocked by:** [29 — Explicit registration](29-explicit-registration-flow.md)

**Status:** ready-for-agent

- [ ] Unregistered opener sees «go register» Russian empty state without throwing
- [ ] Registered opener sees chat picker and leaderboards as today
- [ ] Fixture/dev seeding updated to reflect explicit registration (not join-sync assumptions)
