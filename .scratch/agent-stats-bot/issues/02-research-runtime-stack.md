# 02: Verify the Vercel, Hono, Telegram, and AI SDK shape

Type: research
Status: resolved

## Question

Using current official documentation, determine the smallest supported runtime shape for one Hono app on
Vercel that receives Telegram updates through grammY, records reaction Events, and runs a Vercel AI SDK
tool-loop agent for `/stats` commands.

Resolve the exact packages and adapters, Vercel entry point/configuration, Telegram webhook response model,
relevant function-duration behavior, retry implications, and required `allowed_updates`. Establish whether
the Neon Data Assistant guide's `ToolLoopAgent` pattern transfers directly without Next.js or Chat SDK.

## Done when

- The answer cites current primary documentation.
- It provides a minimal request-flow sketch and dependency list.
- It identifies any platform fact that would force asynchronous work, deduplication, or a second endpoint.
- It does not implement the app.

## Answer

### Conclusion

One Hono app and one Telegram webhook endpoint are sufficient. Vercel detects a default-exported Hono app
from a recognized root or `src/` entry file and turns its routes into Vercel Functions on Fluid Compute;
neither Next.js nor a custom Vercel adapter is required. grammY has a native `"hono"` webhook adapter, and
Vercel AI SDK's `ToolLoopAgent` is framework-independent. The Neon guide's agent-and-query-tool pattern
therefore transfers directly; Chat SDK in that guide supplies Slack/thread integration and conversation
state, neither of which this one-shot Telegram bot needs.

Primary sources: [Vercel's Hono integration](https://vercel.com/docs/frameworks/backend/hono),
[Hono's Vercel guide](https://hono.dev/docs/getting-started/vercel),
[grammY webhook adapters](https://grammy.dev/guide/deployment-types.html#web-framework-adapters),
[AI SDK `ToolLoopAgent`](https://ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent), and the
[Neon Data Assistant guide](https://neon.com/guides/ai-sdk-neon-data-assistant#create-the-ai-agent).

### Smallest dependency set

Runtime dependencies:

- `hono` — HTTP application and routing.
- `grammy` — Telegram Bot API client, update middleware, and `webhookCallback(bot, "hono", ...)`.
- `ai` — `ToolLoopAgent`, `tool`, and loop control; a `creator/model` string uses Vercel AI Gateway without
  another provider package.
- `zod` — tool input schemas.
- `@neondatabase/serverless` — Neon SQL client for the existing operational database and agent query
  connection.
- `@vercel/functions` — `waitUntil` for running the potentially slow agent after acknowledging Telegram.

No `next`, Chat SDK, Slack adapter, or MCP package is needed. AI Gateway is built into `ai`; passing a
plain model string selects it and deployments on Vercel can authenticate automatically. A direct model
provider SDK is only necessary if the implementation deliberately bypasses AI Gateway. See the
[AI Gateway provider documentation](https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway).

### Vercel entry point and configuration

Use a recognized entry file such as `src/index.ts`, construct the Hono app, and `export default app`.
Vercel documents this as zero-configuration: there is no build command, output directory, Next.js route,
or Vercel-specific Hono adapter to add. A `POST /telegram` Hono route can directly use grammY's Hono
callback. `vercel.json` is optional; add a per-function `maxDuration` only if an explicit duration below
the plan maximum is wanted.

Vercel Functions on the current Hobby plan have a 300-second default and maximum duration under Fluid
Compute. `waitUntil(promise)` allows work to continue after the response, but the promise remains bound by
the same function-duration limit and is cancelled when that limit is reached. Sources:
[Vercel Function limits](https://vercel.com/docs/functions/limitations) and
[`@vercel/functions` `waitUntil`](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#waituntil).

The agent should still use an explicit, much smaller `stopWhen`/step limit and total timeout. AI SDK's
current default is up to 20 steps, which is unnecessarily generous for a small stats database and makes
latency/cost less predictable. [`ToolLoopAgent` loop control](https://ai-sdk.dev/docs/agents/building-agents#loop-control)
documents both the default and explicit stop conditions.

### Minimal request flow

```text
Telegram POST /telegram
  -> grammY webhookCallback(bot, "hono", { secretToken })
  -> atomically claim update_id
  -> message: cache its author and detect /stats
     message_reaction: append reaction Events
  -> for /stats, waitUntil(run the one ToolLoopAgent pipeline)
       -> agent receives the command plus Chat/schema/business context
       -> agent calls query_database({ sql }) on the read-only Neon connection
       -> agent formats a brief result or failure explanation
       -> bot sends one or more public Rich Messages
  -> return 2xx to Telegram promptly
```

Bare `/stats` and `/stats <question>` can use this same agent route. The caller supplies default intent for
the bare form (current Season, all Members, all five categories); it does not require a separate HTTP or
application route.

The Neon guide's transferable core is exactly `ToolLoopAgent` plus a Zod-described
`query_database({ sql })` tool whose execute function runs SQL and returns rows or a database error so the
agent can self-correct. Its `processSlackThread` wrapper, Chat SDK state database, Slack adapter, and chart
tool are channel-specific extras. For this bot, call `agent.generate({ prompt })` directly and send the
result through grammY. The guide also recommends supplying schema, relationships, and metric definitions
in the instructions to avoid spending tool turns discovering the schema.

### Webhook timing, retries, and deduplication

Telegram retries a webhook update when the endpoint returns a non-2xx response. Telegram explicitly calls
out `update_id` as the identifier for ignoring repeated webhook deliveries. The webhook should also set a
`secret_token`, which Telegram echoes in `X-Telegram-Bot-Api-Secret-Token` and grammY can verify. See
[`setWebhook` and `Update`](https://core.telegram.org/bots/api#getting-updates).

grammY's callback has a 10-second default middleware timeout. If middleware runs longer, the default
behavior is to throw; Telegram then retries, potentially executing the update many times. grammY advises
against merely returning early while ordinary stateful middleware keeps running because same-chat updates
can then overlap. It recommends moving genuinely long work out of webhook middleware. See
[grammY's webhook timing guidance](https://grammy.dev/guide/deployment-types.html#ending-webhook-requests-in-time).

Telegram also permits one Bot API method to be encoded directly in the webhook HTTP response, but grammY
documents that this "webhook reply" has no observable result or error and supports only one method. Do not
use that optimization for Stats reports: acknowledge with an empty 2xx, then make ordinary Bot API calls
from the `waitUntil` task so failures are catchable and a report can span multiple messages. See
[grammY's webhook-reply tradeoffs](https://grammy.dev/guide/deployment-types.html#webhook-reply).

For this app the split can remain inside the same endpoint:

- Await the short, transactional `update_id` claim and reaction/message database writes before returning.
  This preserves message-before-reaction ordering and lets Telegram retry a failed write.
- For `/stats`, schedule the agent promise with Vercel `waitUntil`, catch its failures, and have that task
  send the result or public failure explanation. The stats interaction is one-shot and has no session state,
  so overlap with later updates does not corrupt a conversation.
- Keep `processed_updates.update_id` (already present in the current schema) as the idempotency boundary.
  This prevents duplicate Events and duplicate Stats reports when Telegram retries before acknowledgement.

`waitUntil` is not a durable queue: once Telegram has received 2xx, a background crash or function timeout
will not cause Telegram to redeliver the command. Nothing in the platform forces a second endpoint for this
toy v1, provided occasional infrastructure-level loss is acceptable. A guarantee that every accepted
command eventually produces a report would require persisting a job and processing it through a durable
queue/Workflow, normally with a worker/second handler. Vercel itself says work remains limited by the
function timeout; grammY recommends a queue for work that cannot finish reliably within webhook timing.

### Required Telegram subscription

Register the webhook with:

```json
{ "allowed_updates": ["message", "message_reaction"] }
```

`message` is required both for `/stats` commands and for caching each message's author so a later reaction
can identify its Subject. `message_reaction` is required for per-user reaction diffs and must be explicitly
listed; Telegram excludes reaction updates from the default subscription. The bot must be a Chat
administrator to receive them, and bot-authored reactions are not delivered. `message_reaction_count` is
not useful here because it represents anonymous aggregate counts, not the Actor needed for Events.
`chat_member` is unnecessary after Registration/Mini App behavior is removed.

Source: [Telegram Bot API `Update` and `allowed_updates`](https://core.telegram.org/bots/api#update).
