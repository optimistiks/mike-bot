# 33 — Authenticate TMA Members and authorize Chat access

**Parent:** [v2 spec](../spec.md)

**What to build:** Treat Telegram launch data as the sole identity presented to protected APIs. A Member with valid, recent init data can list their registered Chats and read only a leaderboard for a Chat where they registered; forged, expired, or cross-Chat requests receive stable errors without data disclosure.

**Blocked by:** [32 — Move fixtures behind deterministic `db:seed`](32-deterministic-database-seed.md)

**Status:** ready-for-agent

- [ ] A shared server authentication boundary validates raw init-data signatures with the bot token and extracts the Telegram Member; unsigned parsing is removed from production authorization.
- [ ] Init data is valid for at most 365 days, with ordinary clock skew handled without weakening signature or age validation.
- [ ] Missing, malformed, invalidly signed, and expired authorization returns HTTP 401 with one stable JSON error shape on both protected APIs.
- [ ] The Chat-picker returns only `chat_memberships` belonging to the authenticated Member.
- [ ] The leaderboard verifies the authenticated Member's registration in the requested Chat and returns HTTP 403 with a stable JSON error shape when it is absent.
- [ ] Invalid leaderboard query parameters remain HTTP 400 and no protected data is returned before authentication and authorization succeed.
- [ ] Request-level tests use genuinely signed init data and cover valid access, no registrations, bad signature, expiry, forbidden Chat access, and malformed queries.
