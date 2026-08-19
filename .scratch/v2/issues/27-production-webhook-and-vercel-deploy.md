# 27 — Production webhook registration and Vercel deploy

**Parent:** [v2 spec](../spec.md)

**What to build:** A `set-webhook.ts` script that registers the Telegram webhook with `secret_token`, `allowed_updates` including `message`, `message_reaction`, and `chat_member` (not `my_chat_member`), and verifies via `getWebhookInfo`. Vercel project configured to deploy `apps/web` from the `v2` branch with server-side env vars only (`BOT_TOKEN`, `BOT_WEBHOOK_SECRET`, `DATABASE_URL` pointing at Neon). Production database client uses Vercel Fluid TCP pooling per ticket 22. Human deploy checklist from the spec is documented (BotFather Menu Button → production HTTPS URL, bot promoted to group admin with privacy mode off, optional v1 import before go-live).

**Blocked by:** [24 — Reaction marking via webhook](24-reaction-marking-via-webhook.md), [29 — Explicit registration](29-explicit-registration-flow.md)

**Status:** ready-for-agent

- [ ] `set-webhook.ts` registers webhook with correct `allowed_updates` and secret token
- [ ] Vercel deploy config targets `apps/web`; build succeeds on `v2`
- [ ] Env vars documented as server-side only (no `NEXT_PUBLIC_*` for secrets)
- [ ] Neon connected via TCP pool + `attachDatabasePool` on deployed Vercel Fluid functions
- [ ] Human deploy checklist included (BotFather Menu Button, group admin, privacy off, Neon URL)
