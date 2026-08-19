# Explicit registration for Mini App access

**Supersedes** the chat roster sync portion of ADR-0005 (`my_chat_member` / join-side `chat_member`).

## Registration

Members opt in to Mini App access by reacting to a **Registration message** posted by the bot. Marks in `events` are recorded for all Members regardless of registration; registration gates Mini App visibility only. Registration messages are ordinary messages, not Telegram-pinned messages.

**`/register` command (admins only, groups/supergroups only):** Bot posts a Russian Registration message and inserts `(chat_id, message_id)` into `registration_messages`. Multiple Registration messages per Chat are valid.

**Registration reaction:** Any reaction on a row in `registration_messages` upserts `chat_memberships` for the actor. No `events` row. Reaction removal does not unregister.

**Reaction handler optimization:** If `message_authors.author_is_bot` is false, skip registration lookup (scoring path). If true, consult `registration_messages`.

## Leave cleanup

On `chat_member` with status `left` or `kicked`, delete `chat_memberships` for that user in that chat. No `my_chat_member` handling.

## Mini App

Menu Button entry unchanged. Picker lists Chats where the opener has a `chat_memberships` row. Unregistered openers see a «go register» prompt only.

## Webhook

`allowed_updates`: `message`, `message_reaction`, `chat_member`.
