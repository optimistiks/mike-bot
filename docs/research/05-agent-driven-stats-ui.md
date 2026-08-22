# Research: agent-driven stats UI

**Date:** 2026-08-22  
**Question:** Should Mike-bot replace or de-emphasize its fixed leaderboard UI in favor of conversational stats in Telegram, a conversational Mini App, MCP-driven UI, or a combination?  
**Primary sources:** [Telegram Bot API](https://core.telegram.org/bots/api), [Telegram Bot Features](https://core.telegram.org/bots/features), [Telegram Mini Apps](https://core.telegram.org/bots/webapps), [MCP 2026-07-28 specification](https://modelcontextprotocol.io/specification/2026-07-28/architecture), [MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview), [official MCP Apps repository](https://github.com/modelcontextprotocol/ext-apps)

## Recommendation

Make the product **agent-first and Telegram-native first**, while retaining the Mini App as an on-demand visual surface:

1. Let a Member ask a stats question through a bot command, mention, or reply: “who was top last summer?”, “compare me with Ivan this year”, or “who gives the most minus Marks?”
2. Give the model a small set of deterministic, read-only stats tools. The model interprets language and chooses tools; application code resolves authorization, time ranges, scoring, and aggregation.
3. Return the common case directly in Telegram. Use a compact text answer, a table when useful, and inline buttons for follow-ups.
4. Open the existing Mini App only when the result materially benefits from a chart, drill-down, or persistent interactive view.
5. Keep the stats tools independent of the model/provider and shape them like MCP tools. Expose them through a remote MCP server later if distribution through ChatGPT, Claude, VS Code, and other hosts becomes valuable.
6. Do **not** make an MCP Apps host inside the Telegram Mini App the first implementation. Telegram is not an MCP host, so Mike-bot would have to own the agent host, iframe sandbox, bridge, consent, tool visibility, CSP, and MCP authorization. Because Mike-bot owns both the Mini App and the stats service, rendering its own structured tool results is simpler and safer.

This changes the fixed leaderboard from “the product” into one possible answer format. It can remain as a fast browseable default without constraining the questions users may ask.

## Why Telegram-native is newly compelling

Telegram's current Bot API is substantially more capable than the traditional command-plus-Markdown bot interface.

### Conversational entry points

Telegram clients surface bot commands in the composer and menu. Commands can be scoped by private chats, group chats, administrators, a specific Chat, a specific Member, and language; the backend must still independently authorize every request because command scope is presentation, not enforcement ([Bot Features: commands and scopes](https://core.telegram.org/bots/features), [Bot API: `BotCommandScope`](https://core.telegram.org/bots/api#botcommandscope)).

In a group, a bot in Privacy Mode receives commands explicitly addressed to it, relevant replies, inline messages, and service messages. Bot administrators and privacy-disabled bots receive all group messages ([Bot FAQ](https://core.telegram.org/bots/faq), [Bot Features: Privacy Mode](https://core.telegram.org/bots/features#privacy-mode)). Mike-bot already needs administrator status to receive `message_reaction` updates, so it should enforce an application-level activation rule—only commands, direct mentions, and replies to Mike-bot invoke the agent—and never send unrelated group conversation to the model.

Useful entry patterns are therefore:

- `/stats who was top last summer?`
- `/stats@MikeBot compare me with Ivan this year`
- `@MikeBot who had the most Humor last summer?`
- a follow-up sent as a reply to Mike-bot's previous answer

Forum supergroups have `message_thread_id`, and private bot chats can also use native topic threads. Private-chat topic mode was added in Bot API 9.3 and is explicitly suitable for bots that need separate conversations; bot responses, edits, chat actions, and drafts can target a topic ([Bot API changelog: Bot API 9.3](https://core.telegram.org/bots/api-changelog), [Telegram forum topics](https://core.telegram.org/api/forum)). Threaded private-chat mode is an optional product choice, not a prerequisite; it also has a Telegram Stars monetization caveat documented in section 6.2.6 of the [Bot Developer Terms](https://telegram.org/tos/bot-developers).

### Rich Messages are much more than old Markdown

Bot API 10.1, released June 11, 2026, introduced Rich Messages specifically for structured and streamed replies. Bot API 10.2, released July 14, completed the outgoing block model ([Bot API recent changes](https://core.telegram.org/bots/api#recent-changes)).

`sendRichMessage` accepts Rich Markdown, Rich HTML, or explicit blocks. The format supports headings, nested ordered and unordered lists, tables, details/collapsible sections, quotations, dividers, formulas, footnotes/references, and embedded media. Rich Markdown is broadly compatible with GitHub Flavored Markdown; a Rich Message can contain up to 32,768 UTF-8 characters, 500 blocks, 16 nesting levels, 20 table columns, and 50 media attachments ([Rich Message formatting](https://core.telegram.org/bots/api#rich-message-formatting-options)).

That is enough for a good native stats answer:

```markdown
## Summer 2025 · Karma received

| # | Member | Karma |
|--:|:-------|------:|
| 1 | Masha  | 42    |
| 2 | Ivan   | 37    |

<details><summary>How this was calculated</summary>
June 1–August 31, 2025, Europe/Moscow. Karma plus minus Karma minus.
</details>
```

Rich Messages are a real alternative to rendering a bespoke leaderboard card for every result. They are still documents, not arbitrary live widgets; charts and direct manipulation remain Mini App territory.

### Streaming and user-only group interactions

`sendMessageDraft` and `sendRichMessageDraft` stream an animated, ephemeral 30-second preview and require a final persistent message. Both draft methods are limited to **private chats**, optionally within a private-chat topic ([`sendMessageDraft`](https://core.telegram.org/bots/api#sendmessagedraft), [`sendRichMessageDraft`](https://core.telegram.org/bots/api#sendrichmessagedraft)). Group answers cannot use this streaming mechanism; use `sendChatAction` while computing and send the final answer once.

Bot API 10.2 also introduced Ephemeral Commands and Ephemeral Messages in groups. An ephemeral command and its response are visible only to the requesting Member and the bot. Because Mike-bot is a Chat administrator, it can send a user-specific ephemeral response without a callback token, although Telegram says delivery is not guaranteed, especially when the Member is offline ([Ephemeral Messages and Commands](https://core.telegram.org/bots/api#ephemeral-messages-and-commands)).

There is an important current split:

- `sendMessage` supports `receiver_user_id`, so a basic-formatted answer and inline keyboard can be private on the group's public timeline.
- `sendRichMessage` does **not** currently expose `receiver_user_id`, so a full Rich Message in a group is public.
- In a private chat, Rich Messages and streamed Rich Message drafts are both available.

This suggests two good modes rather than one compromised mode:

- **Public group answer:** mention/reply → compact Rich Message that is useful to the group.
- **Private answer from group:** ephemeral `/stats` → compact basic message with an “Open full answer” or “Continue privately” action.

The repo's installed `grammy` 1.45.1 already exposes typed APIs for Rich Messages, both draft methods, `receiver_user_id`, and ephemeral-message edits/deletion. These platform features do not require bypassing grammY with hand-written Bot API requests.

### Inline keyboards and Mini Apps

Inline keyboards can carry callback data, open URLs, switch into inline mode, or launch a Web App where supported. Telegram recommends editing an existing message/keyboard for navigation instead of sending a sequence of new messages ([Bot Features: keyboards and inline mode](https://core.telegram.org/bots/features)). Buttons fit bounded follow-ups such as `Karma`, `Humor`, `Given`, `Previous period`, and `Open chart`; they should not replace the free-form question.

Mini Apps are full HTML/JavaScript applications inside a Telegram WebView. Telegram supports launch from a bot's profile/main app, keyboards and inline buttons, the menu button, inline mode, direct links, and—only for approved bots—the attachment menu. Mini Apps receive Telegram context and theme information and can send results back into Telegram ([Telegram Mini Apps](https://core.telegram.org/bots/webapps)).

The existing Mike-bot Mini App authentication pattern remains correct: send `Telegram.WebApp.initData` to the backend, validate its signature with the bot token, enforce freshness using `auth_date`, and never authorize from `initDataUnsafe` ([validating Mini App data](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)). Bot API 10.2 also hardened Mini Apps by restricting Mini App methods to the configured origin by default as of July 20, 2026 ([Bot API 10.2 changes](https://core.telegram.org/bots/api#recent-changes)).

## What MCP and MCP Apps actually provide

### MCP is the tool/data boundary

MCP is an open protocol between an AI host and capability servers. In the current 2026-07-28 architecture, the host owns model orchestration, user consent, authorization decisions, and context aggregation; a client communicates with one server; servers expose focused tools, resources, and prompts. The protocol is stateless and built on JSON-RPC ([MCP architecture](https://modelcontextprotocol.io/specification/2026-07-28/architecture)).

For Mike-bot, the valuable part of MCP is not “AI-generated UI.” It is a stable, typed contract for questions the agent may answer:

- tools perform deterministic computation or retrieval;
- resources expose application-controlled context;
- prompts are user-controlled templates ([MCP server primitives](https://modelcontextprotocol.io/specification/2026-07-28/server/index)).

Remote HTTP MCP servers use the protocol's OAuth-based authorization model. The current specification requires audience-bound tokens, bearer tokens in headers rather than query strings, protected-resource discovery, and least-privilege scope selection; token passthrough is forbidden ([MCP authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)).

The official TypeScript SDK v2 is the stable line for the 2026-07-28 protocol; official Tier 1 SDKs also exist for Python, Go, and C# ([2026-07-28 release](https://blog.modelcontextprotocol.io/posts/2026-07-28/), [TypeScript SDK v2](https://ts.sdk.modelcontextprotocol.io/v2/api/%40modelcontextprotocol/server/)).

### MCP Apps is an optional UI extension

MCP Apps is the official interactive-UI extension. A tool declares `_meta.ui.resourceUri` pointing to a `ui://` HTML resource. A compatible host fetches it, renders it in a sandboxed iframe, passes tool data to it, and proxies JSON-RPC messages over `postMessage`. The app can call allowed server tools, send a follow-up message, or update model-visible context ([MCP Apps overview](https://modelcontextprotocol.io/extensions/apps/overview), [stable 2026-01-26 Apps specification](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx)).

The security model is stronger than embedding arbitrary HTML directly:

- the iframe cannot access the host DOM, cookies, or local storage;
- the host controls available capabilities and proxied tool calls;
- UI resources declare external origins and permissions through CSP metadata;
- communication is inspectable JSON-RPC over `postMessage` ([MCP Apps security model](https://modelcontextprotocol.io/extensions/apps/overview#security-model), [MCP Apps CSP](https://apps.extensions.modelcontextprotocol.io/api/documents/csp-and-cors.html)).

The official `@modelcontextprotocol/ext-apps` package supports view authors, React views, server registration, and host integration through AppBridge. The repository explicitly says it does not ship a supported host beyond its `basic-host` example ([official MCP Apps repository](https://github.com/modelcontextprotocol/ext-apps)). Vercel AI SDK 7 now documents a host path for Next.js using `@ai-sdk/mcp` and `experimental_MCPAppRenderer`; the renderer is explicitly experimental ([Vercel MCP Apps host guide](https://vercel.com/kb/guide/ai-sdk-mcp-apps)).

### Maturity and portability

Core MCP is widely implemented, but MCP Apps support is capability-dependent. The official MCP documentation currently lists Claude, Claude Desktop, VS Code GitHub Copilot, Microsoft 365 Copilot, Goose, Postman, MCPJam, and Archestra as MCP Apps hosts; the support matrix continues to evolve ([MCP Apps client support](https://modelcontextprotocol.io/extensions/apps/overview#client-support)). ChatGPT also officially implements the MCP Apps standard and recommends keeping every tool useful without UI so text-only clients still work ([OpenAI MCP Apps UI guide](https://developers.openai.com/plugins/build/chatgpt-ui)).

Therefore “write once, render anywhere” is a direction with real implementations, not a guarantee of identical behavior in every MCP client. A portable Mike-bot MCP server should always return meaningful `content` and `structuredContent`, feature-detect App capabilities, and treat an interactive view as progressive enhancement.

Telegram is not an MCP Apps host. An MCP App cannot render inline inside a Telegram message. It can render only inside a host that implements the extension, or inside a custom host Mike-bot builds into its Mini App.

## What questions the current Mike-bot data can answer

The current storage is a good foundation for arbitrary **time-range scoring** questions.

The append-only `events` table contains `chatId`, Event type, Actor, Subject, message ID, and action timestamp. `messageAuthors` contains each observed message's author and Telegram message timestamp. `displayIdentities` contains the latest known Chat-scoped display name. Current leaderboard aggregation already maps Event types into Karma received, Humor received, Karma plus given, Karma minus given, and Humor given.

Arbitrary date ranges are supportable, with one essential attribution rule:

- for native v2 Events, filter by `messageAuthors.messageDate`, because a Mark belongs to the time when the marked message was sent;
- for imported v1 Events, which have no message timestamp and have a non-null `legacyId`, filter by `events.createdAt`;
- retain the existing compensating Event semantics for removed reactions.

This is the same distinction implemented by `queryLeaderboard` and required by ADR-0003. A generic range query must not simplify everything to `events.createdAt`, or reactions added near a boundary will be credited to the wrong period.

Immediately answerable examples include:

- top Karma or Humor recipients over any resolved date range;
- top givers of Karma plus, Karma minus, or Humor Marks;
- one Member's totals over a range;
- comparisons between Members;
- month/week/day series and changes between ranges;
- net Karma versus positive and negative components;
- counts grouped by Member, Mark type, or message ID.

The current data cannot answer questions that require message content or complete message activity. ADR-0005 intentionally stores no message text. The bot therefore cannot explain *why* someone was funny, quote the best message, summarize conversation topics, calculate Marks per all messages sent, or search what people discussed. It also stores the latest display identity rather than a historical name for each Event.

“Who was top last summer?” is feasible, but it introduces a domain distinction: a Season is currently exactly one Moscow calendar month, while “summer” spans three months. The answer should be a `Stats report` or `Time-range ranking`, not silently redefine `Season` or the existing seasonal `Leaderboard`. The response must echo the resolved interval, metric, and timezone—for example, `June 1–August 31, 2025 · Europe/Moscow · Karma received`—so the model's natural-language interpretation remains visible and correct.

## Concrete architecture options

| Option | Strengths | Costs and limits | Recommendation |
| --- | --- | --- | --- |
| Fixed Mini App leaderboard | Fast predictable browsing; no model cost; already implemented | Only answers predesigned questions; UI complexity grows with every dimension | Keep as a default/fallback, not the primary product model |
| Telegram group agent | Zero context switch; natural social sharing; Rich Messages and inline follow-ups | Public answers can clutter; no draft streaming; full Rich Messages cannot currently be user-only | Make this a primary entry point with explicit activation rules |
| Telegram private-chat agent with topics | Private, supports Rich Message draft streaming and separate native threads | Member must enter the bot chat and select/resolve a registered Chat; topic mode is optional platform complexity | Best surface for longer analysis and follow-up conversations |
| Mini App chat with native React result components | Full control over streaming, charts, history, and layout; reuses current Telegram auth | Mike-bot owns the complete chat UX and model backend | Add when the bot-native answer format is insufficient |
| Mini App as a custom MCP Apps host | Can render third-party MCP Apps and use a standard UI bridge | Owns sandbox, CSP, capability negotiation, consent, tool proxying, auth, and experimental host APIs | Do not start here; revisit only for third-party MCP App interoperability |
| Remote Mike-bot MCP server | Makes the same stats available to ChatGPT/Claude/other hosts; MCP Apps can add portable charts | Requires OAuth/account linking beyond Telegram init data and per-Chat authorization; external-host product surface to support | Build after Telegram UX proves the tools and external distribution has value |

## Suggested internal tool boundary

Do not expose SQL to the model. Inject the authenticated `chatId` and Member identity outside the prompt, then offer a small read-only tool set:

```text
resolve_time_range(phrase, now, timezone)
rank_members(metric, start, end, limit)
member_stats(member, start, end)
compare_members(members, metrics, start, end)
stats_series(metric, start, end, interval)
render_stats_view(report_id, presentation)
```

Design rules:

- `chatId` is server context, never a model-selected argument.
- Each tool validates dates, maximum range, limit, and metric enum.
- Tools return exact machine-readable inputs and provenance with the result: resolved start/end, `Europe/Moscow`, metric, event count, and whether v1 imported data is included.
- All calculations are deterministic application code. The model explains results but does not calculate them from raw Events.
- `render_stats_view` is separate from data tools. This follows the MCP Apps recommendation to keep computation and rendering decoupled and avoids remounting a UI for every intermediate tool call ([OpenAI's decoupled MCP Apps pattern](https://developers.openai.com/plugins/build/chatgpt-ui#separate-data-processing-from-ui-rendering)).
- Authorization remains deterministic: a group query is scoped to that Chat; a private bot or Mini App query requires the existing Registration for the chosen Chat; a future remote MCP server requires an OAuth grant mapped to the same Member and Registrations.
- Conversation state must be isolated by surface. A group thread is shared context; a private topic or Mini App chat is per Member. Do not allow a model-generated `chatId`, stale conversation state, or UI request to cross that boundary.

## A pragmatic sequence

1. Build and evaluate the deterministic range-query layer without changing the Mini App UI.
2. Add one explicit Telegram entry point such as ephemeral `/stats <question>` plus a public mention/reply mode.
3. Render final private-chat answers with Rich Messages; use basic formatted ephemeral group answers and public Rich Messages where appropriate.
4. Add inline follow-ups and an `Open chart` path into the existing Mini App only for questions that benefit from visualization.
5. Add Mini App chat/history if users actually sustain multi-turn analysis beyond what private bot topics provide.
6. Expose the proven tool layer over remote MCP when there is a concrete external host/use case. Add MCP Apps views as progressive enhancement, with text fallback.

The key bet is the stats tool model, not any single presentation layer. Telegram, the Mini App, and external MCP hosts should all consume the same deterministic domain capability rather than each growing a separate interpretation of scoring.
