# 34 — Adopt the TMA React SDK in the production Mini App

**Parent:** [v2 spec](../spec.md)

**What to build:** Make the production Mini App behave as a native Telegram surface through the TMA React SDK. A Telegram launch initializes the platform lifecycle, authenticates API requests with untouched launch data, renders within Telegram's theme and safe viewport, and uses the native Back Button for leaderboard navigation; a direct production browser visit stops at clear Russian guidance.

**Blocked by:** [33 — Authenticate TMA Members and authorize Chat access](33-tma-identity-and-chat-authorization.md)

**Status:** ready-for-agent

- [ ] The client uses `@tma.js/sdk-react`; the manually loaded native script and direct `window.Telegram.WebApp` access are removed.
- [ ] SDK initialization restores raw launch data before protected requests and sends it unchanged with the `tma` authorization scheme.
- [ ] Supported Mini App, theme, viewport, safe-area, content-safe-area, and Back Button components are mounted in the required order and bind their CSS variables.
- [ ] The viewport expands without requesting fullscreen, and readiness is signaled only after a meaningful application shell can render.
- [ ] The native Back Button is visible only on the leaderboard, returns to the Chat picker, and clears leaderboard navigation state.
- [ ] A visible back control is used only when native Back Button support is unavailable.
- [ ] A production launch outside Telegram renders Russian “open through Telegram” guidance and issues no protected API requests.
- [ ] Application-boundary tests cover launch-data forwarding, non-TMA behavior, and native/fallback Back Button navigation without asserting SDK internals.
