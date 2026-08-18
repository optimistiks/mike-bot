# Mike-bot

A Telegram group scoring bot: members mark each other's messages, and a Mini App shows honest seasonal leaderboards.

## Language

**Karma**:
A member's net score from Karma plus minus Karma minus. An integer, no decay. Computed as the sum of `karma` events where the member is `subject_id`.
_Avoid_: carma, score, уважение

**Karma plus**:
The scoring reaction that adds 1 Karma to the message author. Persisted as an event: `type: karma`, `value: +1`.
_Avoid_: plus, +, ➕ as the concept name (those are v1 triggers)

**Karma minus**:
The scoring reaction that subtracts 1 Karma from the message author. Persisted as an event: `type: karma`, `value: -1`.
_Avoid_: minus, −, ➖ as the concept name

**Humor**:
Points a member receives when someone puts the Humor scoring reaction on their message. An integer, no decay. Persisted as an event: `type: humor`, `value: +1`.
_Avoid_: lol, лол, humor points as a separate type from Humor

**Event**:
A persisted scoring fact in Postgres: `type` + `value`, scoped to a `chat_id`, with `actor_id` (who scored) and `subject_id` (who received). Not tied to Telegram field names — the bot adapter writes events; the Mini App reads them.
_Avoid_: mark row, lol record

**Mark**:
The user-facing act of applying or removing a Scoring reaction. Applying a reaction creates an Event; removing it undoes that Event.
_Avoid_: conflating Mark with the DB row name

**Scoring reaction**:
One of the three configured Telegram reactions: 👍 (Karma plus), 👎 (Karma minus), 🤣 (Humor). Standard emoji only. The v2 adapter maps these to Events.
_Avoid_: vote, emoji (too vague), лол

**Chat**:
A conversation scoped by `chat_id`. The bot may serve many Chats; leaderboards are scoped per Chat.
_Avoid_: assuming a single group

**Member**:
A non-bot user in a Chat, identified by `user_id`. Members cannot Mark themselves or bots. Display name comes from `chat_members`, not from Event rows.
_Avoid_: user, account (prefer Member in this domain)

**Chat member**:
A row in `chat_members` keyed by (`chat_id`, `user_id`) holding the latest known `@username` (or first name). Updated when a Member appears in a v2 Event. Seeded from `legacy_marks` on import for v1-only Members.
_Avoid_: storing display names only on Event rows

**Season**:
A calendar month inside a calendar year (e.g. 2026-08). Events belong to the Season in which they were created.
_Avoid_: period, window

**Current Season**:
The Season for today's year and month in `Europe/Moscow`. The Mini App must show it as the live season (UI copy may say "Ongoing season").
_Avoid_: treating "ongoing" as a different kind of Season

**Mini App**:
The Telegram Mini App that shows honest Karma and Humor leaderboards by Season, including v1 history.
_Avoid_: stats command, /stats

**v1**:
The AWS Lambda Telegraf bot on `master`. It scored via reply text (`+`, `-`, `лол`) and stored rows in DynamoDB `lolTable`. v1 history imports as-is into `legacy_marks` — not into `events`.
_Avoid_: old bot, legacy bot as glossary terms (say v1)

**Crown**:
Flair on the #1 entry in a leaderboard section (👑).
_Avoid_: winner badge as a separate concept

**Chicken**:
Flair on the last-place entry in a leaderboard section (🐔), matching v1 `/stats` tone.
_Avoid_: loser badge as a separate concept
