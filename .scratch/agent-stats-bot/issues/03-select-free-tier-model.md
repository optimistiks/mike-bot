# 03: Select the free-tier model

Type: research
Status: resolved

## Question

At implementation time, which model available through Vercel's free tier is the best fit for this agent?
Prioritize reliable tool calling, SQL generation and repair, Russian-language understanding, latency, and a
context window sufficient for the schema and business rules. Confirm what “free” means and whether the
choice requires Vercel AI Gateway or a provider account.

Because availability and pricing change, record the evidence date and one fallback model rather than
encoding an eternal recommendation.

## Done when

- The answer cites current Vercel/provider documentation.
- One primary model and one fallback are named with a short rationale.
- Required model/provider environment variables are listed.

## Answer

Evidence checked **2026-08-22**.

Use **`openai/gpt-5.6-luna`** through Vercel AI Gateway, with **`openai/gpt-5.6-terra`** as
the fallback model.

### Why Luna

- Vercel's current catalog lists Luna with tool use and reasoning support, a 1.05M-token context window,
  and a 128K-token output limit. Its current standard rates are $0.20/M input tokens, $1.20/M output
  tokens, and $0.02/M cached input tokens. Vercel describes it as the fast, affordable member of the
  GPT-5.6 family. That context is far beyond what this bot needs for its schema and business rules.
  ([Vercel model page](https://vercel.com/ai-gateway/models/gpt-5.6-luna),
  [Vercel public model catalog](https://ai-gateway.vercel.sh/v1/models))
- The model supports function calling and structured outputs, and Vercel publishes an AI SDK example
  using a Zod-defined tool with this exact model ID. This is direct evidence that it fits the planned
  query-tool loop rather than merely producing free-form text.
  ([Vercel Luna API example](https://vercel.com/ai-gateway/models/gpt-5.6-luna/api))
- OpenAI's published GPT-5.6 results show Luna essentially tied with Terra on the relevant tool-use
  proxies: 53.4% versus 53.1% on Toolathlon and 14.9% versus 15.2% on AutomationBench. OpenAI also calls
  Luna its fastest and most affordable tier. At one tenth of Terra's current standard token prices,
  Luna is the sensible default for repeated agent/tool turns under a small monthly allowance.
  ([OpenAI GPT-5.6 launch](https://openai.com/index/gpt-5-6/),
  [OpenAI model catalog](https://developers.openai.com/api/docs/models))
- OpenAI states that its latest models are multilingual, which includes the GPT-5.6 family. However,
  neither Vercel nor OpenAI publishes a Luna-specific Russian or text-to-SQL score in the cited current
  material. Russian understanding and SQL generation/repair are therefore supported by multilingual,
  coding, reasoning, and tool-use evidence, but remain workload-specific assumptions rather than proven
  benchmark claims. The implementation should keep the model ID configurable so a small real-query
  evaluation can overturn this choice without a code change.
  ([OpenAI model catalog](https://developers.openai.com/api/docs/models))

Use the normal reasoning tier first rather than a paid fast-service variant. The bot's short public
answers keep output cost and latency down; the tool loop can feed a PostgreSQL error back to Luna for a
repair attempt.

### Fallback: Terra

Configure **`openai/gpt-5.6-terra`** in AI Gateway's model fallback list. Terra has the same 1.05M-token
context window, 128K output limit, function calling, structured outputs, and multilingual family support,
but is the more capable balanced tier. Its current standard rates are $2/M input and $12/M output, so it
is too expensive to use as the default under a $5 allowance but reasonable for failed Luna requests.
([Vercel Terra model page](https://vercel.com/ai-gateway/models/gpt-5.6-terra),
[OpenAI Terra model page](https://developers.openai.com/api/docs/models/gpt-5.6-terra))

AI Gateway tries model fallbacks only when the primary request fails or is unavailable. It does **not**
detect a syntactically valid but semantically wrong SQL query and escalate it to Terra; SQL errors should
be returned to the active model inside the tool loop for self-repair.
([Vercel model-fallback documentation](https://vercel.com/docs/ai-gateway/models-and-providers/model-fallbacks))

### What “free” means

This recommendation does **not** mean Luna or Terra has zero token prices. Vercel's free AI Gateway tier
currently supplies **$5 of gateway credit per Vercel team every 30 days**, beginning with the first
request, and the credit can be spent on the available model catalog at the listed provider rates. Buying
AI Gateway credits moves the team to the paid tier and ends the recurring free credit. Free-tier requests
also have model-specific rate limits.
([Vercel AI Gateway pricing](https://vercel.com/docs/ai-gateway/pricing),
[Vercel pricing walkthrough](https://vercel.com/academy/ai-gateway/ai-gateway-pricing))

Re-check the [free-tier-filtered model catalog](https://vercel.com/ai-gateway/models?freeTier=true) and
the two model pages immediately before implementation because availability and rates are mutable.

### Accounts and environment variables

Use **Vercel AI Gateway**, not a direct OpenAI integration:

- No OpenAI account, billing setup, or `OPENAI_API_KEY` is required when Vercel supplies the inference
  credentials and charges the team's AI Gateway credits.
- On a Vercel deployment, AI Gateway can authenticate with the project-linked, automatically generated
  **`VERCEL_OIDC_TOKEN`**; do not manually create a provider key for this path.
- For local development or CI outside the Vercel runtime, create a Gateway key and set
  **`AI_GATEWAY_API_KEY`**. The AI SDK reads it automatically. A locally pulled OIDC token is an alternative,
  but it expires after 12 hours.
  ([Vercel authentication documentation](https://vercel.com/docs/ai-gateway/authentication-and-byok),
  [Vercel agent guide](https://vercel.com/kb/guide/ai-gateway-and-ai-sdk))
- Add app-owned configuration such as **`AI_MODEL=openai/gpt-5.6-luna`** and
  **`AI_FALLBACK_MODEL=openai/gpt-5.6-terra`** so this date-sensitive selection is not buried in code.
  Those two names are project conventions, not variables required by Vercel.

Vercel's AI SDK accepts the creator/model strings directly and uses AI Gateway as the default provider;
the fallback belongs in `providerOptions.gateway.models`.
([Vercel models and providers](https://vercel.com/docs/ai-gateway/models-and-providers),
[Vercel model-fallback documentation](https://vercel.com/docs/ai-gateway/models-and-providers/model-fallbacks))
