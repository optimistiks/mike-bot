# Chat roster sync and message author cache

**Chat roster (`chat_memberships`):** When the bot joins a chat (`my_chat_member`) or a member joins/leaves (`chat_member`), sync `chat_id` + `user_id` membership. On join, seed from `getChatAdministrators` / member list where practical. The Mini App uses this: given the opener's `user_id` from initData, list chats where they are a member and the bot is present → user picks a chat → leaderboard for that `chat_id`.

**Message authors (`message_authors`):** `MessageReactionUpdated` includes `chat`, `message_id`, and `user` (who reacted). It does **not** include who wrote the message. Bot API has no `getMessage` — cache on `message` updates (privacy mode off).

Columns:

| Column | Source | Why |
| --- | --- | --- |
| `chat_id` | `message.chat.id` | PK part |
| `message_id` | `message.message_id` | PK part |
| `author_id` | `message.from.id` or `message.sender_chat.id` | `subject_id` lookup |
| `author_is_bot` | `message.from.is_bot` | Enforce "no scoring bots" without re-fetch |
| `message_date` | `message.date` | Optional audit; Seasons use reaction time, not this |

**Do not store:** text, caption, entities, media, replies, forwards, edits. Not needed for scoring; adds privacy surface and churn.

**Upsert:** first write wins for `author_id` (author of a message doesn't change). Update `author_is_bot` / `message_date` only if missing.

**No row → skip scoring** on reaction for that message (bot never saw it).

**Webhook idempotency:** Store processed `update_id`; ignore duplicates before appending events.
