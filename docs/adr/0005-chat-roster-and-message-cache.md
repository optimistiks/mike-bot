# Chat roster sync and message author cache

**Chat roster (`chat_memberships`):** When the bot joins a chat (`my_chat_member`) or a member joins/leaves (`chat_member`), sync `chat_id` + `user_id` membership. On join, seed from `getChatAdministrators` / member list where practical. The Mini App uses this: given the opener's `user_id` from initData, list chats where they are a member and the bot is present → user picks a chat → leaderboard for that `chat_id`.

**Message authors (`message_authors`):** `MessageReactionUpdated` includes `chat`, `message_id`, and `user` (who reacted). It does **not** include who wrote the message. Persist `chat_id` + `message_id` → `author_id` when the bot receives `message` updates (privacy mode off). Look up `subject_id` when handling reactions.

**Webhook idempotency:** Store processed `update_id`; ignore duplicates before appending events.
