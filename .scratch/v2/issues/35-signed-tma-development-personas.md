# 35 — Provide faithful signed TMA development personas

**Parent:** [v2 spec](../spec.md)

**What to build:** Let a developer open the Mini App in an ordinary local browser and exercise the same authenticated TMA flow as production. The local environment supplies realistic Telegram platform events and valid signed init data for deterministic seeded personas, while production contains no usable development init-data signing or identity bypass.

**Blocked by:** [34 — Adopt the TMA React SDK in the production Mini App](34-tma-react-sdk.md)

**Status:** resolved

- [x] Development follows the official TMA template's `mockTelegramEnv` pattern when it is not already running inside Telegram.
- [x] Mock launch parameters cover theme, viewport, safe area, content safe area, and request/response events required by the mounted SDK components.
- [x] A fixed, non-secret development bot token signs valid init data for an allowlist of personas created by `db:seed`.
- [x] The default persona is registered; selectable known personas demonstrate unregistered and forbidden Chat states through the real protected APIs.
- [x] Arbitrary identities are not signed, and local persona selection cannot become a production authentication mechanism.
- [x] Development init-data signing and the mock environment are unreachable in production builds and production runtime.
- [x] Tests demonstrate that local signed personas pass normal validation while equivalent production mock access is unavailable.

## Answer

Local development now follows the official TMA template lifecycle: the server-rendered page signs one of three seeded persona names, passes the raw init data directly to the client bootstrap, installs `mockTelegramEnv`, and answers the theme, viewport, safe-area, and content-safe-area requests required by the real SDK adapter. The default `registered` persona and the `unregistered` and `forbidden` query selections exercise the normal protected APIs without an identity bypass or a development-only HTTP route.

Signing uses the fixed non-secret `TMA_DEVELOPMENT_BOT_TOKEN` loaded from `.env.development`. The server-render and request-authentication call sites dynamically load local/test support only behind direct `process.env.NODE_ENV !== "production"` checks; production continues to require `BOT_TOKEN`. Node and headless-Chromium tests cover env-backed signing, the allowlist, production rejection, protected API outcomes, and the full mocked SDK launch.
