# How does Grammy receive reaction Marks on Vercel?

> Historical record: this resolved ticket is not canonical current-state documentation. Its question, answer, and acceptance criteria may now be false; use the Wayfinder map and specification for current behavior.

Type: research
Status: resolved

## Question

What is the supported way to run a Grammy bot on Vercel (Next.js Route Handler) so it receives `message_reaction` updates, including removals, with a secret token and `allowed_updates`? What are the serverless timeout, body-size, and retry constraints that would affect applying/undoing a Mark?

## Answer

Use a Next.js App Router POST handler (`app/api/telegram/route.ts`) exporting `webhookCallback(bot, 'std/http', { secretToken })`. Set webhook with `allowed_updates: ['message_reaction', ...]` — reactions are opt-in and excluded by default. Bot must be group admin. Handle add and remove via `bot.on('message_reaction')` + `ctx.reactions()` (not `bot.reaction()` alone). Keep handlers fast; Grammy defaults to 10s webhook timeout and Telegram retries non-2xx.

Full findings: `docs/research/01-grammy-vercel-webhook.md`
