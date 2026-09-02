# Mike-bot

A Telegram scoring bot where Members mark each other's messages, compare Karma
and Humor, and talk to the bot in a Conversation.

## Scoring

**Mark**:
A scoring an Actor applies to a different Member's Message. Permanent once
placed. An Actor may hold one Karma Mark and one Humor Mark on the same
Message, never two of the same slot.
_Avoid_: Vote, rating, Event, lol

**Scoring reply**:
An exact trimmed `+`, `-`, or case-insensitive `лол` reply that places the
corresponding Mark. The bot deletes an accepted Scoring reply and answers
under the marked Message with `➕ (name)`, `➖ (name)`, or `лол (name)`, where
name is the Actor's Telegram username or `???`. A reply whose slot is already
spent is left untouched and unanswered. A Scoring reply is never itself a
Message that can be marked.
_Avoid_: Reaction, command, legacy reply

**Karma plus**:
A Mark that adds one to the Subject's Karma.
_Avoid_: Upvote, plus

**Karma minus**:
A Mark that subtracts one from the Subject's Karma.
_Avoid_: Downvote, minus

**Humor Mark**:
A Mark that adds one to the Subject's Humor.
_Avoid_: Lol, joke vote

**Karma**:
A Member's all-time net total of received Karma plus and Karma minus Marks in
one Chat.
_Avoid_: Carma, score, respect

**Humor**:
A Member's all-time total of received Humor Marks in one Chat.
_Avoid_: Lol score, humor points

**Actor**:
The Member who places a Mark.
_Avoid_: Giver, reactor

**Subject**:
The Member whose Message receives the Mark.
_Avoid_: Recipient, target

**Mark type**:
The canonical value a Mark carries: `karma.plus`, `karma.minus`, or
`humor.add`.
_Avoid_: Event type, lol type

**Mark slot**:
One of the two grants an Actor holds for every other Member's Message:
`karma`, spendable as Karma plus or Karma minus but never both, and `humor`,
independent of it.
_Avoid_: Kind, category

**Imported Mark**:
A Mark reconciled from v1, Mike-bot's retired AWS-hosted predecessor. v1 knew
only Scoring replies. Nothing distinguishes it in the model except that it
already happened.
_Avoid_: Legacy row, migration

## Community

**Chat**:
A Telegram chat whose Marks, Standings, and Conversations are isolated from
every other Chat. The same Member may participate in more than one Chat.
_Avoid_: Room, group

**Member**:
A non-bot person identified by their stable Telegram identity.
_Avoid_: User, account

**Display name**:
The name printed for a Member in Standings and in a Scoring reply answer:
their Telegram username, or `???`.
_Avoid_: @mention, first name, User {id}

**Message**:
The Telegram identity of a message that may receive Marks. Mike-bot stores no
Message content.
_Avoid_: Post content

## Standings

**Standings**:
The all-time ranking of one Chat, presented as five sections in this order:
Karma received (Уважаемые люди), Humor received (Юмористы), Karma plus given
(Поставили ➕), Karma minus given (Поставили ➖), Humor given (Поставили лол).
Every Member who ever gave or received a Mark in that Chat appears in every
section, zeros included.
_Avoid_: Leaderboard, scoreboard, stats

**Stats command**:
The `/stats` command that prints Standings in the Chat and deletes the
command. In a Chat with no Marks it does nothing and the command stays.
_Avoid_: Stats question, report, Mini App link

**Humor decay**:
A display-only reduction of Humor received, applied when printing the Humor
section of Standings. Stored Marks do not change.
_Avoid_: Ranking penalty, aging

**Crown**:
Flair on every Member tied for the highest total in the Karma received or
Humor received section.
_Avoid_: Winner badge

**Chicken**:
Flair on every Member tied for the lowest total in the Karma received or
Humor received section when at least one Member has a strictly higher total.
_Avoid_: Loser badge

## Conversation

**Conversation**:
A per-Member, per-Chat free-form exchange with the bot. It opens on a Wake
message, closes on a Stop message, and while open holds that Member's Turns
as context. Isolated from every other Conversation, including others in the
same Chat. Not a Mark and not the Stats command.
_Avoid_: Session, Dialogflow session, chat

**Wake message**:
A text message that opens a Conversation. The Member has no open Conversation
in that Chat, and the trimmed text, compared case-insensitively, is `бот` or
begins with `бот` and a following space. A Wake message is also a Turn: the
bot answers it.
_Avoid_: Mention, command, trigger

**Stop message**:
A text message that closes a Conversation. The trimmed text, compared
case-insensitively, is exactly `довольно`. A Stop message is not a Turn.
_Avoid_: Cancel, exit, довольно as ordinary text

**Turn**:
A text message in an open Conversation that becomes part of that
Conversation's context. Wake messages are Turns. Scoring replies and Stop
messages are not.
_Avoid_: Prompt, utterance, LLM call
