# Mike-bot v2

Telegram scoring bot and Mini App on Vercel (Next.js + Neon Postgres).

## Development

```bash
npm install
npm run dev      # turbo → apps/web
npm run test
npm run build
```

Local database tests use PGlite — no Neon or AWS credentials required.

## Layout

- `apps/web` — Next.js App Router app (webhook, Mini App, API)
- `docs/` — ADRs and research
- `.scratch/v2/` — spec and implementation tickets

Branch policy: all v2 work on `v2`. Do not commit to `master` (live v1 until cutover).
