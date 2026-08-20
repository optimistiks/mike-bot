# What happens at the edges?

> Historical record: this resolved ticket is not canonical current-state documentation. Its question, answer, and acceptance criteria may now be false; use the Wayfinder map and specification for current behavior.

Type: grilling
Status: resolved

## Question

Two edge cases need a decided behaviour:

1. **Mini App chat picker empty** — opener has no rows in `chat_memberships` (not in any group with the bot). What does the UI show?
2. **Reaction on uncached message** — `message_authors` has no row for that `message_id` (bot never saw the message). Skip silently, log only, or something else?

## Answer

**Empty chat picker:** Russian empty state on Mini App home — «Нет общих чатов с ботом» plus a short hint to add the bot to a group. No error throw, no retry loop.

**Amended (2026-08-19):** Superseded for unregistered openers by [Explicit registration model](28-explicit-registration-model.md) — show «go register» copy (react to a Registration message; admin runs `/register`). Ticket [30 — Mini App go-register empty state](30-mini-app-go-register-empty-state.md).

**Uncached message on reaction:** Skip scoring — do not append an event. Silent in the group (no bot message). `console.log` with `chat_id`, `message_id`, `actor_id` — toy-grade, no structured logging stack.

**No backfill:** Bot API has no `getMessage`; if uncached, the mark is lost for scoring.
