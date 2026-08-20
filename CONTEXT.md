# Mike-bot

A Telegram group scoring bot: members mark each other's messages, and a Mini App shows honest seasonal leaderboards.

## Language

**Karma**:
A Member's net score: Karma plus minus Karma minus. Karma plus and Karma minus are independent and may both be active on the same message.
_Avoid_: carma, score, уважение

**Karma plus**:
The Scoring reaction that adds one Karma to a message's author.
_Avoid_: plus, +, ➕ as the concept name (those are v1 triggers)

**Karma minus**:
The Scoring reaction that subtracts one Karma from a message's author.
_Avoid_: minus, −, ➖ as the concept name

**Humor**:
The count a Member receives when others apply the Humor Scoring reaction to their messages. Humor has no decay.
_Avoid_: lol, лол, humor points as a separate concept

**Event**:
An immutable record that a Mark was applied or removed. Its Event type determines its scoring effect; Events are never rewritten or deleted.
_Avoid_: mark row, lol record, mutable score

**Event type**:
The closed vocabulary describing an Event: `karma.plus`, `karma.minus`, `karma.undo.plus`, `karma.undo.minus`, `humor.add`, or `humor.undo.add`.
_Avoid_: encoding numeric weights in the name; `karma.add` / `karma.remove`

**Actor**:
The Member who applies or removes a Scoring reaction.
_Avoid_: confusing Actor with Subject

**Subject**:
The Member who wrote the marked message and receives the scoring effect.
_Avoid_: assuming the reacting Member is the Subject

**Mark**:
The user-facing act of applying or removing a Scoring reaction. Each change produces one Event.
_Avoid_: treating removal as deletion of an earlier Event

**Scoring reaction**:
One of the configured Telegram reactions: 👍 (Karma plus), 👎 (Karma minus), or 🤣 (Humor).
_Avoid_: vote, emoji (too vague), лол

**Chat**:
A Telegram conversation with its own Members, Marks, registration, and leaderboards. Mike-bot may serve many Chats without sharing their data.
_Avoid_: assuming one fixed group

**Chat membership**:
A Member's explicit registration for Mini App access in one Chat. It is independent of whether the Member may receive Marks or currently belongs to the Telegram group.
_Avoid_: Telegram group membership, Chat member

**Registration message**:
An ordinary bot message posted after a Chat administrator runs `/register`. Reacting to it registers that Actor for Mini App access in that Chat.
_Avoid_: treating its reactions as Marks

**Member**:
A non-bot participant identified by their stable Telegram identity. Members cannot Mark themselves or bots.
_Avoid_: account; user when discussing this domain role

**Chat member**:
The latest known display identity for a Member in one Chat. It is presentation data, not proof of Chat membership.
_Avoid_: Chat membership

**Message author**:
The cached identity of a message's Subject, used because Telegram reaction updates identify the Actor but not the Subject. Message content is not part of this concept.
_Avoid_: storing message bodies; inferring the Subject from the Actor

**Season**:
A calendar month within a calendar year, interpreted in `Europe/Moscow`. Events belong to the Season in which they occurred.
_Avoid_: period, rolling window

**Current Season**:
The Season containing the present date in `Europe/Moscow`.
_Avoid_: treating ongoing as a different kind of Season

**Mini App**:
The Telegram app that shows a registered Member the seasonal Karma and Humor leaderboards for a selected Chat. It opens from the bot's Menu Button.
_Avoid_: stats command, `/stats`

**v1**:
The previous AWS-hosted bot on `master`, whose reply-based Marks are imported once into v2 history.
_Avoid_: old bot, legacy bot as glossary terms

**Crown**:
Flair on the first entry in a leaderboard section (👑).
_Avoid_: winner badge as a separate concept

**Chicken**:
Flair on the last entry in a leaderboard section (🐔), preserving v1's tone.
_Avoid_: loser badge as a separate concept
