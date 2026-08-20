# 27 — Production webhook registration and Vercel deploy

> Historical record: this resolved ticket is not canonical current-state documentation. Its question, answer, and acceptance criteria may now be false; use the Wayfinder map and specification for current behavior.

**Parent:** [v2 spec](../spec.md)

**What to build:** A `set-webhook.ts` script that registers the Telegram webhook with `secret_token`, `allowed_updates` including `message`, `message_reaction`, and `chat_member` (not `my_chat_member`), and verifies via `getWebhookInfo`. Vercel project configured to deploy `apps/web` from the `v2` branch with server-side env vars only (`BOT_TOKEN`, `BOT_WEBHOOK_SECRET`, `DATABASE_URL` pointing at Neon). Production database client uses Vercel Fluid TCP pooling per ticket 22. Human deploy checklist from the spec is documented (BotFather Menu Button → production HTTPS URL, bot promoted to group admin with privacy mode off, optional v1 import before go-live).

**Blocked by:** [24 — Reaction marking via webhook](24-reaction-marking-via-webhook.md), [29 — Explicit registration](29-explicit-registration-flow.md)

**Status:** resolved

- [x] `set-webhook.ts` registers webhook with correct `allowed_updates` and secret token
- [x] Vercel deploy config targets `apps/web`; build succeeds on `v2`
- [x] Env vars documented as server-side only (no `NEXT_PUBLIC_*` for secrets)
- [x] Neon connected via TCP pool + `attachDatabasePool` on deployed Vercel Fluid functions
- [x] Human deploy checklist included (BotFather Menu Button, group admin, privacy off, Neon URL)

## Answer

Added production deploy plumbing (ticket 27):

- `apps/web/scripts/set-webhook.ts` — `setWebhook` with `secret_token` and `allowed_updates` (`message`, `message_reaction`, `chat_member`); verifies via `getWebhookInfo`
- `apps/web/lib/bot/webhook-setup.ts` — shared allowed-update list and `assertWebhookRegistered` (rejects `my_chat_member`)
- `apps/web/vercel.json` — monorepo install/build for Root Directory `apps/web`
- `README.md` — server-only env vars, human deploy checklist, `set-webhook` usage

Run: `pnpm --filter @mike-bot/web set-webhook` with `BOT_TOKEN`, `BOT_WEBHOOK_SECRET`, `WEBHOOK_URL`.

Neon TCP pooling (`attachDatabasePool`) was already in ticket 22 (`lib/db/production.ts`).
