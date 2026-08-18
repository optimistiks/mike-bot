# How does a Next.js Mini App authenticate on Vercel?

Type: research
Status: resolved

## Question

From Telegram and Next.js primary docs (and redesigned-giggle only as a pattern check): how does a Mini App on Vercel validate `initData`, attach to a bot via Menu Button or Keyboard button, and call our backend? What must be true in BotFather for the Mini App URL?

## Answer

Telegram injects signed init data in the WebView URL. Client reads raw init data (`@tma.js/sdk-react`) and sends `Authorization: tma <rawInitData>` on API calls. Server validates HMAC with `BOT_TOKEN` via `@tma.js/init-data-node` in a Route Handler. BotFather Menu Button / Mini App link must point at production HTTPS (Vercel). No cookies or separate login.

Full findings: `docs/research/02-mini-app-auth-next.md`
