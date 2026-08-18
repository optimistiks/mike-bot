# 25 — Mini App navigation (memberships, chat picker, season drill-down)

**Parent:** [v2 spec](../spec.md)

**What to build:** Sync `chat_memberships` on `my_chat_member` and `chat_member` updates so the Mini App can list Chats where the opener is a member and the bot is present. A chats list API parses `user.id` from Telegram initData naively (no HMAC). Full Mini App flow in Russian: chat picker with empty state («Нет общих чатов с ботом» plus hint to add the bot to a group), season selector (Current Season default and clearly marked, year/month drill-down), navigation to five leaderboard sections for the selected `chat_id` with crown/chicken rendered in the UI. Request/response shapes validated with Zod where applicable.

**Blocked by:** [23 — Leaderboard read path](23-leaderboard-read-path.md)

**Status:** ready-for-agent

- [ ] `chat_memberships` rows created/removed on bot join and member join/leave
- [ ] Chats list API returns memberships for opener's `user_id` from naive initData parse
- [ ] Empty picker shows Russian empty state without throwing
- [ ] Season selector defaults to Current Season (`Europe/Moscow`) with year/month drill-down
- [ ] Selecting a chat loads five leaderboard sections scoped to that `chat_id`
- [ ] All user-visible Mini App copy is Russian
