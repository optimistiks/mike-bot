# Mike-bot

A Telegram group scoring bot: members mark each other's messages, and a Mini App shows honest seasonal leaderboards.

## Language

**Karma**:
A member's net score from Karma plus minus Karma minus. An integer, no decay. Derived in application code from karma-related event types where the member is `subject_id`.
_Avoid_: carma, score, уважение

**Karma plus**:
The scoring reaction that adds 1 Karma to the message author. Persisted as event type `karma.plus`.
_Avoid_: plus, +, ➕ as the concept name (those are v1 triggers)

**Karma minus**:
The scoring reaction that subtracts 1 Karma from the message author. Persisted as event type `karma.minus`.
_Avoid_: minus, −, ➖ as the concept name

**Humor**:
Points a member receives when someone puts the Humor scoring reaction on their message. An integer, no decay. Derived from humor-related event types.
_Avoid_: lol, лол, humor points as a separate type from Humor

**Event**:
An append-only row in `events` with a `type` string (e.g. `karma.plus`, `karma.undo.minus`, `humor.add`). No numeric value column — how each type affects scores is defined in application code, not the schema. Events are never updated or deleted.
_Avoid_: mark row, lol record, hardcoded score deltas in the database

**Event type**:
The `type` field on an Event. Closed vocabulary for v2 reactions: `karma.plus`, `karma.minus`, `karma.undo.plus`, `karma.undo.minus`, `humor.add`, `humor.undo.add`.
_Avoid_: encoding scores as numbers in the type name; `karma.add` / `karma.remove` (superseded naming)

**Actor**:
The Member who applied or removed a Scoring reaction. Maps to Telegram `MessageReactionUpdated.user` → `actor_id` on the Event.
_Avoid_: confusing actor with subject

**Subject**:
The Member who wrote the message being reacted to — who receives the score. Maps to `subject_id` on the Event. **Not** present on the reaction update; resolved via `message_authors` cache.
_Avoid_: assuming `reaction.user` is the subject

**Mark**:
The user-facing act of applying or removing a Scoring reaction. Each change appends one Event with the matching event type.
_Avoid_: conflating Mark with a single DB row; deleting on undo

**Scoring reaction**:
One of the three configured Telegram reactions: 👍 (Karma plus), 👎 (Karma minus), 🤣 (Humor). Standard emoji only. The v2 adapter maps these to event types.
_Avoid_: vote, emoji (too vague), лол

**Chat**:
A conversation scoped by `chat_id`. The bot may serve many Chats; leaderboards are scoped per Chat.
_Avoid_: assuming a single group

**Chat membership**:
A row in `chat_memberships` keyed by (`chat_id`, `user_id`) recording that a Member has **explicitly registered** for Mini App access in that Chat (by reacting to a registration message). Removed on `chat_member` leave/kick. Used by the Mini App chat picker. Marks in `events` are recorded regardless of registration.
_Avoid_: conflating with `chat_members` (display names); conflating with Telegram group membership

**Registration message**:
A bot-posted pin in a Chat, created when an admin runs `/register`. Its `message_id` is stored in `registration_messages`. Any reaction on a registered pin registers the actor for Mini App access in that Chat.
_Avoid_: treating registration reactions as Marks (no `events` row)

**Member**:
A non-bot user in a Chat, identified by `user_id`. Members cannot Mark themselves or bots. Display name comes from `chat_members`, not from Event rows.
_Avoid_: user, account (prefer Member in this domain)

**Chat member**:
A row in `chat_members` keyed by (`chat_id`, `user_id`) holding the latest known `@username` (or first name). Updated when a Member appears in a v2 Event. Seeded from v1 import (`fromUser`/`toUser` in `scripts/import-v1.ts`) for v1-only Members.
_Avoid_: storing display names only on Event rows; conflating with chat membership roster

**Message author**:
A row in `message_authors` keyed by (`chat_id`, `message_id`) → `author_id`, plus `author_is_bot` and `message_date`. Populated when the bot receives `message` updates. Used to resolve `subject_id` on reaction events. Do not store message text or media.
_Avoid_: reading subject from `MessageReactionUpdated.user`; caching full message bodies

**Season**:
A calendar month inside a calendar year (e.g. 2026-08). Events belong to the Season in which they were created.
_Avoid_: period, window

**Current Season**:
The Season for today's year and month in `Europe/Moscow`. The Mini App must show it as the live season (UI copy may say "Ongoing season").
_Avoid_: treating "ongoing" as a different kind of Season

**Mini App**:
The Telegram Mini App that shows honest Karma and Humor leaderboards by Season, including v1 history. Opens from the Bot Menu Button. Opener picks a Chat from registered memberships (`chat_memberships`), then sees that Chat's boards. Unregistered openers see a prompt to complete registration first.
_Avoid_: stats command, /stats

**v1**:
The AWS Lambda Telegraf bot on `master`. It scored via reply text (`+`, `-`, `лол`) and stored rows in DynamoDB `lolTable`. v1 history is one-shot imported into `events` (converted to v2 event types, `legacy_id` set) — see [v1 import into events](.scratch/v2/issues/21-v1-import-into-events.md).
_Avoid_: old bot, legacy bot as glossary terms (say v1)

**Crown**:
Flair on the #1 entry in a leaderboard section (👑).
_Avoid_: winner badge as a separate concept

**Chicken**:
Flair on the last-place entry in a leaderboard section (🐔), matching v1 `/stats` tone.
_Avoid_: loser badge as a separate concept
