# Research: Grammy + Vercel Webhook for `message_reaction` (Wayfinder)

**Ticket:** mike-bot v2 wayfinder  
**Question:** How does Grammy receive reaction marks on Vercel?  
**Sources:** [grammy.dev](https://grammy.dev), [Telegram Bot API](https://core.telegram.org/bots/api), [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers), [Vercel Functions Limits](https://vercel.com/docs/functions/limitations). Optional pattern reference: `/tmp/redesigned-giggle`.

---

## End-to-end flow

1. A user adds/changes a reaction in a chat where the bot is an **administrator**.
2. Telegram serializes a `Update` with `message_reaction: MessageReactionUpdated` and POSTs JSON to the webhook URL (HTTPS, port 443).
3. Vercel invokes the Next.js Route Handler (serverless function).
4. `webhookCallback` validates `X-Telegram-Bot-Api-Secret-Token`, parses the body, and calls `bot.handleUpdate(update)`.
5. Grammy routes the update to registered handlers (`bot.reaction(...)`, `bot.on('message_reaction', ...)`, etc.).
6. Handler completes; `webhookCallback` responds **HTTP 200**. Telegram stops retrying for that update.

If `message_reaction` is **not** in `allowed_updates`, Telegram never delivers these updates — Grammy cannot receive them regardless of handler code.

---

## Recommended Next.js App Router pattern

### File layout

```
app/
  api/
    telegram/
      route.ts          # webhook endpoint
lib/
  bot/
    bot.ts              # Bot singleton + handler registration
scripts/
  set-webhook.ts        # one-time / deploy hook to call setWebhook
```

Grammy’s adapter table ([deployment types](https://grammy.dev/guide/deployment-types)) lists:

| Adapter | Runtime |
|---|---|
| `next-js` | Next.js **Pages Router** API routes (`req.body` + `res`) |
| `https` / `http` | Node.js `http`/`https`, **Vercel Serverless (Pages `api/`)** |
| `std/http` | Web `Request`/`Response` — **App Router Route Handlers**, Edge |

For **App Router**, use the `std/http` adapter: it accepts a standard `Request` and returns a `Response` via `handlerReturn` ([grammY `frameworks.ts`](https://github.com/grammyjs/grammY/blob/main/src/convenience/frameworks.ts)).

### `app/api/telegram/route.ts`

```ts
import { webhookCallback } from 'grammy'
import { bot } from '@/lib/bot/bot'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs' // default; use for DB/Node-only plugins
export const maxDuration = 10    // align with Grammy webhook timeout (see below)

export const POST = webhookCallback(bot, 'std/http', {
  secretToken: process.env.BOT_WEBHOOK_SECRET,
})
```

### `lib/bot/bot.ts`

```ts
import { Bot } from 'grammy'

const token = process.env.BOT_TOKEN
if (!token) throw new Error('BOT_TOKEN is unset')

export const bot = new Bot(token)

// Do NOT call bot.start() when using webhooks.

// Option A: only newly *added* reactions (recommended for “mark” semantics)
bot.reaction('👍', async (ctx) => {
  // ctx carries reaction context; handler runs on add only
})

// Option B: full reaction diff (adds, removes, multi-emoji changes)
bot.on('message_reaction', async (ctx) => {
  const { emojiAdded, emojiRemoved } = ctx.reactions()
  // MessageReactionUpdated only includes message_id, not message text
})
```

**Module-level bot singleton:** Instantiate `Bot` and register handlers once at import time, not inside `POST`. Re-instantiating per request loses middleware state and adds cold-start cost.

**Pages Router alternative (legacy Grammy Vercel guide):** `api/bot.ts` with `export default webhookCallback(bot, 'https')` ([grammy.dev/hosting/vercel](https://grammy.dev/hosting/vercel)). That path is documented for the older `api/` directory layout, not App Router.

---

## Setting `allowed_updates` including `message_reaction`

### Telegram defaults (critical)

From [Update](https://core.telegram.org/bots/api#update) and [setWebhook](https://core.telegram.org/bots/api#setwebhook):

- Default / empty `allowed_updates` receives **all types except** `chat_member`, `message_reaction`, and `message_reaction_count`.
- `message_reaction` must be **explicitly listed** to receive per-user reaction changes in private chats and groups.
- `message_reaction_count` is separate — required for anonymous/channel reaction counts.

### `message_reaction` update requirements

| Requirement | Source |
|---|---|
| Bot is **administrator** in the chat | Telegram Bot API `Update.message_reaction` |
| `"message_reaction"` in `allowed_updates` | Telegram Bot API `setWebhook` / `getUpdates` |
| Updates **not** sent for reactions set by bots | Telegram Bot API `Update.message_reaction` |

### Registration via `setWebhook`

```ts
import { Bot, API_CONSTANTS } from 'grammy'

const bot = new Bot(process.env.BOT_TOKEN!)

await bot.api.setWebhook('https://your-app.vercel.app/api/telegram', {
  secret_token: process.env.BOT_WEBHOOK_SECRET!, // 1–256 chars, [A-Za-z0-9_-]
  allowed_updates: [
    'message',
    'edited_message',
    'message_reaction',        // required for reaction marks in groups/DMs
    'message_reaction_count',  // optional: channels / anonymous counts
    // ... other types your bot needs
  ],
  // drop_pending_updates: true,  // optional on deploy
})

const info = await bot.api.getWebhookInfo()
console.log(info.url, info.allowed_updates)
```

Grammy also documents using `API_CONSTANTS.ALL_UPDATE_TYPES` when you want every update type including the opt-in ones ([Reactions guide](https://grammy.dev/guide/reactions)).

**Deploy script pattern:** `/tmp/redesigned-giggle/apps/web-tanstack/scripts/set-webhook.ts` sets `secret_token` + `allowed_updates`, then verifies via `getWebhookInfo()`.

**Browser one-liner (no `allowed_updates`):** Grammy’s Vercel guide shows `https://api.telegram.org/bot<token>/setWebhook?url=<url>` — that **does not** enable `message_reaction`. Always set `allowed_updates` in code or POST body.

---

## Secret token validation

Two-sided configuration:

### 1. Telegram `setWebhook.secret_token`

- Telegram sends header `X-Telegram-Bot-Api-Secret-Token` on every webhook POST ([setWebhook](https://core.telegram.org/bots/api#setwebhook)).
- Allowed characters: `A-Z`, `a-z`, `0-9`, `_`, `-`. Length 1–256.

### 2. Grammy `webhookCallback` `secretToken`

From [WebhookOptions](https://grammy.dev/ref/core/webhookoptions):

```ts
webhookCallback(bot, 'std/http', {
  secretToken: process.env.BOT_WEBHOOK_SECRET,
})
```

GrammY compares the incoming header to `secretToken` ([`compareSecretToken` in webhook.ts](https://github.com/grammyjs/grammY/blob/main/src/convenience/webhook.ts)). On mismatch → **401** `"unauthorized"` / `"secret token is wrong"`. Telegram treats non-2xx as failed delivery and **retries**.

**Operational note:** Use the same value for `setWebhook.secret_token` and `webhookCallback.secretToken`. Store in Vercel env vars (e.g. `BOT_WEBHOOK_SECRET`).

---

## Serverless constraints that matter for reaction handling

### Vercel function limits ([docs](https://vercel.com/docs/functions/limitations))

| Constraint | Typical impact on reactions |
|---|---|
| **Request body max 4.5 MB** | Reaction updates are small JSON; not a concern. |
| **Response body max 4.5 MB** | Same. |
| **Default max duration 300s** (Hobby) | Far above reaction handler needs, but see Grammy/Telegram timeouts below. |
| **Cold starts** | First webhook after idle adds latency; keep handler lean. |
| **Concurrent executions** | Updates from **different chats** deliver concurrently; same chat is sequential (Telegram-side). |

### Grammy internal webhook timeout (10s default)

From [deployment types — webhook timeouts](https://grammy.dev/guide/deployment-types):

- `webhookCallback` default `timeoutMilliseconds: 10_000`.
- If middleware exceeds this, default `onTimeout: 'throw'` → unhandled error → likely **non-2xx** → Telegram **retries the same update** (possibly many times, causing duplicate side effects).

Grammy’s Vercel hosting guide recommends `maxDuration: 10` in `vercel.json` for the bot function ([hosting/vercel](https://grammy.dev/hosting/vercel)). For App Router, export `maxDuration` from the route segment ([Next.js maxDuration](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/maxDuration)).

### Telegram delivery & retry behavior

From [setWebhook](https://core.telegram.org/bots/api#setwebhook):

> In case of an unsuccessful request (HTTP status code different from `2XY`), we will repeat the request and give up after a reasonable amount of attempts.

From Grammy deployment docs:

- Telegram waits for webhook response before sending the **next update in the same chat** (sequential per chat).
- Slow handlers block that chat’s queue; timeouts cause duplicate processing.

**Implication for reaction handlers:** Persisting a “mark”, updating DB, and sending a confirmation message must finish within ~10s (Grammy default) or you must tune `timeoutMilliseconds` / use a queue pattern Grammy recommends for long work.

### Do not use Edge runtime unless necessary

Grammy notes limited plugin support on Vercel Edge ([hosting/vercel](https://grammy.dev/hosting/vercel)). Prefer `runtime = 'nodejs'` (Next.js default) for reaction tracking that touches DB/session plugins.

---

## Gotchas

### 1. Administrator requirement

Bot must be **chat administrator** to receive `message_reaction` and `message_reaction_count` ([Telegram Bot API](https://core.telegram.org/bots/api#update)). Without admin, reactions appear in the client but no webhook fires.

### 2. `allowed_updates` omission

Most common misconfiguration. Default webhook/polling **excludes** `message_reaction`. Symptom: messages work, reactions silent. Fix: re-`setWebhook` with explicit array; verify with `getWebhookInfo().allowed_updates`.

### 3. `bot.reaction` vs `bot.on('message_reaction')` vs raw update

From [Reactions guide](https://grammy.dev/guide/reactions) and [Bot.reaction API](https://grammy.dev/ref/core/bot#reaction):

| API | Triggers when | Does not trigger when |
|---|---|---|
| `bot.reaction('👍', …)` | User **adds** matching emoji/custom/paid reaction | Reaction removed; anonymous count-only updates |
| `bot.on('message_reaction', …)` | Any reaction list change (`old_reaction` → `new_reaction`) | `message_reaction_count` events |
| `bot.on('message_reaction_count', …)` | Anonymous/channel aggregate counts | Per-user reaction identity |

For “user marked with 👍”, `bot.reaction('👍', …)` is the ergonomic choice. For undo/remove logic, use `bot.on('message_reaction')` + `ctx.reactions()`.

### 4. Payload shape — no message body

`MessageReactionUpdated` includes `chat`, `message_id`, `user`/`actor_chat`, `old_reaction`, `new_reaction` — **not** the message text ([Bot API](https://core.telegram.org/bots/api#messagereactionupdated)). Plan to key marks by `(chat.id, message_id)` and store message metadata separately when the bot originally sent the message.

### 5. Bot-initiated reactions are invisible

Telegram does not send `message_reaction` updates for reactions **set by bots** ([Update.message_reaction](https://core.telegram.org/bots/api#update)). Only human (non-bot) reaction changes count.

### 6. Channel / anonymous reactions

Channels and auto-forwarded channel posts emit `message_reaction_count`, not `message_reaction`. Counts may be **delayed up to a few minutes** and grouped ([Bot API](https://core.telegram.org/bots/api#update)).

### 7. Webhook retries & idempotency

Non-2xx or timeout → Telegram retries → duplicate handler runs. Reaction side effects (DB writes, replying) should be **idempotent** (e.g. upsert on `(chat_id, message_id, user_id, emoji)`).

### 8. Do not call `bot.start()`

GrammY throws if `bot.start()` is used while webhooks are active ([webhook.ts guard](https://github.com/grammyjs/grammY/blob/main/src/convenience/webhook.ts)). Webhook mode only.

### 9. Do not end the webhook early (`onTimeout: 'return'`)

Grammy warns that responding before middleware finishes causes **parallel updates per chat** and breaks session plugin / race-prone state ([deployment types](https://grammy.dev/guide/deployment-types)). Prefer fast handlers or external queue; keep default `onTimeout: 'throw'`.

### 10. `getUpdates` vs webhook mutual exclusion

While webhook is set, `getUpdates` is disabled ([setWebhook notes](https://core.telegram.org/bots/api#setwebhook)).

---

## Reference: redesigned-giggle pattern (non-primary)

`/tmp/redesigned-giggle` mirrors the above:

- `webhookCallback(bot, 'std/http', { secretToken })` in `bot-webhook.ts`
- Route POST delegates to handler (`routes/api/bot.ts`)
- `scripts/set-webhook.ts` sets `message_reaction` + `message_reaction_count` in `allowed_updates`
- Handlers use `bot.on('message_reaction')` reading `ctx.update.message_reaction` directly

---

## Checklist for wayfinder reaction marks

- [ ] App Router route at `app/api/telegram/route.ts` with `webhookCallback(bot, 'std/http', { secretToken })`
- [ ] Bot singleton + handlers at module scope; **no** `bot.start()`
- [ ] `setWebhook` with `allowed_updates` including `"message_reaction"`
- [ ] Bot promoted to **administrator** in target groups/channels
- [ ] `BOT_WEBHOOK_SECRET` synced between Vercel env and `setWebhook.secret_token`
- [ ] Handler completes within Grammy’s 10s webhook window (or queue heavy work)
- [ ] Idempotent persistence keyed by chat + message + user + reaction
- [ ] Choose `bot.reaction` (add-only) vs `bot.on('message_reaction')` (full diff) deliberately

---

## Source links

- [grammY webhookCallback](https://grammy.dev/ref/core/webhookcallback)
- [grammY WebhookOptions](https://grammy.dev/ref/core/webhookoptions)
- [grammY deployment types (adapters, timeouts)](https://grammy.dev/guide/deployment-types)
- [grammY Vercel hosting](https://grammy.dev/hosting/vercel)
- [grammY Reactions guide](https://grammy.dev/guide/reactions)
- [grammY Bot.reaction](https://grammy.dev/ref/core/bot#reaction)
- [Telegram setWebhook](https://core.telegram.org/bots/api#setwebhook)
- [Telegram Update / message_reaction](https://core.telegram.org/bots/api#update)
- [Telegram MessageReactionUpdated](https://core.telegram.org/bots/api#messagereactionupdated)
- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Next.js maxDuration](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/maxDuration)
- [Vercel Functions limitations](https://vercel.com/docs/functions/limitations)
