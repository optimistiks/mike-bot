# Archive the Next.js Mini App domain and start from scratch

v2 on this branch grew a Next.js Mini App, Scoring reactions, Seasons, and
Registration. That source stays in `apps/web` as frozen code. Its glossary,
ADRs, and research notes are not the live model: they live under
`docs/archive/nextjs-v2/`. The live product is a from-scratch Hono Telegram
bot with v1 Scoring replies, v1 Standings, and Conversations that replace
Dialogflow. Implementation may be cherry-picked from `apps/web`; vocabulary
and decisions are not inherited unless recorded again here.
