# 25 — Mini App navigation (memberships, chat picker, season drill-down)

> Historical record: this resolved ticket is not canonical current-state documentation. Its question, answer, and acceptance criteria may now be false; use the Wayfinder map and specification for current behavior.

**Parent:** [v2 spec](../spec.md)

**What to build:** Sync `chat_memberships` on `my_chat_member` and `chat_member` updates so the Mini App can list Chats where the opener is a member and the bot is present. A chats list API parses `user.id` from Telegram initData naively (no HMAC). Full Mini App flow in Russian: chat picker with empty state («Нет общих чатов с ботом» plus hint to add the bot to a group), season selector (Current Season default and clearly marked, year/month drill-down), navigation to five leaderboard sections for the selected `chat_id` with crown/chicken rendered in the UI. Request/response shapes validated with Zod where applicable.

**Blocked by:** [23 — Leaderboard read path](23-leaderboard-read-path.md)

**Status:** resolved

- [x] `chat_memberships` rows created/removed on bot join and member join/leave
- [x] Chats list API returns memberships for opener's `user_id` from naive initData parse
- [x] Empty picker shows Russian empty state without throwing
- [x] Season selector defaults to Current Season (`Europe/Moscow`) with year/month drill-down
- [x] Selecting a chat loads five leaderboard sections scoped to that `chat_id`
- [x] All user-visible Mini App copy is Russian

## Answer

Implemented `chat_memberships` sync on `my_chat_member` and `chat_member` in `lib/bot/handle-update.ts`, naive initData parsing in `lib/mini-app/init-data.ts`, `/api/chats` with Zod validation, and a Russian Mini App client flow (chat picker → season drill-down → five leaderboard sections with crown/chicken). Local dev uses `?devUserId=101` when Telegram initData is unavailable.

**Amended (2026-08-19):** Join-sync via `my_chat_member` / join-side `chat_member` superseded by [Explicit registration model](28-explicit-registration-model.md). Picker, season drill-down, and `/api/chats` remain; membership population moves to tickets [29](29-explicit-registration-flow.md) and [30](30-mini-app-go-register-empty-state.md).
