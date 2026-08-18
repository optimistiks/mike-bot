# How is the repo laid out?

Type: grilling
Status: resolved

## Question

Grammy webhook + Next.js Mini App on Vercel — one Next.js project (`app/api/telegram` + `app/` pages) or a monorepo with separate bot and web packages? What does redesigned-giggle suggest we avoid, and what fits v2 scope?

## Answer

**Turborepo monorepo** at the repo root — not a single flat Next.js tree. Vercel deploys the web app from the workspace.

**Greenfield alongside v1.** On `v2`, scaffold the monorepo at root (`apps/`, `packages/`, `turbo.json`, workspace `package.json`). Existing v1 `src/` stays in the tree, unwired from the v2 build. Archive/delete v1 at cutover.

**App Router + `std/http` webhook** in the Next.js app: `app/api/telegram/route.ts` with `webhookCallback(bot, 'std/http')`.

**No giggle copy.** redesigned-giggle is not a source to port from. Skip “production” hardening for this toy — no initData validation layer, no copied auth/webhook boilerplate from reference repos. Build what we need inline when we build.

**Layout** (inside `apps/web/`):

```
app/
  api/
    telegram/route.ts
    leaderboard/route.ts
  page.tsx                  # Mini App entry
lib/
  bot/
  scoring/
  db/
scripts/
  set-webhook.ts
  import-v1.ts
```

**Runtime:** don't specify — Next.js Node default is fine.

**Avoid:** TanStack Start, Kamal, Docker/VPS (giggle deploy stack). Turborepo + Vercel only.
