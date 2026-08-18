# How do we display usernames that changed?

Type: grilling
Status: resolved

## Question

Leaderboards are keyed by Telegram user id, but names change. v1 `legacy_marks` stores `fromUser.username` / `toUser.username` at mark time (imported as-is). v2 `marks` will see new usernames on each reaction. What name does the Mini App show on a leaderboard row — and does it differ between v1 history and v2 live data?

## Answer

Separate `chat_members` table: (`chatId`, `userId`) → latest `@username` or first name. Updated on every v2 Mark (reactor and author). Seeded from `legacy_marks` on import so v1-only Members still have a label. Leaderboards aggregate by `userId`, join `chat_members` for display. v1 Mark rows stay as-is; display name is not read from individual Mark rows.
