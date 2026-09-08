# Mike-bot v2

Telegram scoring bot on Vercel. Members mark
each other's messages, print Standings with `/stats`, and talk to the bot in a
Conversation.

## Development

```bash
pnpm install
pnpm fmt:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Bot tests use PGlite and MSW — no Neon, AWS, Telegram, or AI Gateway
credentials required. `pnpm test` runs the bot-core update-handler tests
only.

## Layout

- `packages/bot-core` — grammY bot, schema, migrations, AI Gateway, tests
- `apps/bot-app` — Next.js app that runs bot-core and displays a sample Telegram mini-app page.
- `packages/v1-export` — DynamoDB scan to JSON (no Postgres)
- `packages/v1-import` — JSON → Postgres (depends on bot-core + v1-export)

Branch policy: all v2 work on `v2`. Do not commit to `master` (live v1 until
cutover).
