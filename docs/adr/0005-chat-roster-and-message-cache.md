# Message author cache and webhook idempotency

Chat membership is explicit and defined by [ADR-0006](./0006-explicit-registration.md). This ADR defines the message-author cache required for scoring and the update claim that protects webhook database effects.

**Message authors (`message_authors`):** `MessageReactionUpdated` includes `chat`, `message_id`, and `user` (who reacted). It does **not** include who wrote the message. Bot API has no `getMessage` — cache on `message` updates (privacy mode off).

Columns:

| Column          | Source                                        | Why                                                 |
| --------------- | --------------------------------------------- | --------------------------------------------------- |
| `chat_id`       | `message.chat.id`                             | PK part                                             |
| `message_id`    | `message.message_id`                          | PK part                                             |
| `author_id`     | `message.from.id` or `message.sender_chat.id` | `subject_id` lookup                                 |
| `author_is_bot` | `message.from.is_bot`                         | Enforce "no scoring bots" without re-fetch          |
| `message_date`  | `message.date`                                | Optional audit; Seasons use reaction time, not this |

**Do not store:** text, caption, entities, media, replies, forwards, edits. Not needed for scoring; adds privacy surface and churn.

**Insert:** first write wins for the complete cached record because a message's author and original metadata do not change.

**No row → skip scoring** on reaction for that message (bot never saw it).

**Webhook idempotency:** Store processed `update_id`; ignore duplicates before appending events.

**Display identity:** Keep each Member's latest known display name per Chat outside Event history. New v2 observations replace older names; the v1 import only fills identities that v2 has not observed.
