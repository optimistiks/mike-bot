# 35 — Provide faithful signed TMA development personas

**Parent:** [v2 spec](../spec.md)

**What to build:** Let a developer open the Mini App in an ordinary local browser and exercise the same authenticated TMA flow as production. The local environment supplies realistic Telegram platform events and valid signed init data for deterministic seeded personas, while production contains no usable mock signer or identity bypass.

**Blocked by:** [34 — Adopt the TMA React SDK in the production Mini App](34-tma-react-sdk.md)

**Status:** ready-for-agent

- [ ] Development follows the official TMA template's `mockTelegramEnv` pattern when it is not already running inside Telegram.
- [ ] Mock launch parameters cover theme, viewport, safe area, content safe area, and request/response events required by the mounted SDK components.
- [ ] A fixed, non-secret development bot token signs valid init data for an allowlist of personas created by `db:seed`.
- [ ] The default persona is registered; selectable known personas demonstrate unregistered and forbidden Chat states through the real protected APIs.
- [ ] Arbitrary identities are not signed, and local persona selection cannot become a production authentication mechanism.
- [ ] The mock signer and mock environment are unreachable in production builds and production runtime.
- [ ] Tests demonstrate that local signed personas pass normal validation while equivalent production mock access is unavailable.
