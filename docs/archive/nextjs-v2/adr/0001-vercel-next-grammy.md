# Host v2 on Vercel with Next.js and grammY

v1 runs on AWS CodeStar, Lambda, and Telegraf, and stays live on `master` until a separate cutover. v2 is a new BotFather bot, developed on the `v2` branch and hosted on Vercel as a single Next.js App Router app: one Route Handler receives the Telegram webhook through grammY, the same deployment serves the Mini App, and Postgres is provisioned through Vercel's Neon integration. One framework, one deployment target, and one database keep a friends-and-family project cheap to run and small to reason about; the cost is that the bot's availability is tied to the web app's, and that Lambda's separate scaling story is given up.

Dialogflow and Amazon Polly are retired with v1.
