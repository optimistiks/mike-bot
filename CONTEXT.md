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
already happened. The Message it belongs to takes the earliest Imported Mark
on that Message as its post time.
_Avoid_: Legacy row, migration

## Community

**Chat**:
A Telegram chat whose Marks, Standings, and Conversations are isolated from
every other Chat. Mike-bot does not filter on chat type. The same Member may
participate in more than one Chat.
_Avoid_: Room, group, supergroup

**Member**:
A non-bot person identified by their stable Telegram identity.
_Avoid_: User, account

**Display name**:
The latest Telegram username Mike-bot has seen for that Member, or `???`.
One name per Member, not per Chat. Standings print it. A Scoring reply answer
uses the username on that Scoring reply, or `???`.
_Avoid_: @mention, first name, User {id}

**Message**:
The cached identity of a Telegram message that may receive Marks: its Chat,
id, author, and post time. Mike-bot stores no Message content. An imported
Message's post time is the earliest Imported Mark on it.
_Avoid_: Post content

**Command**:
A Member message Telegram treats as a bot command, including the Stats
command. Never a Turn and never a Scoring reply.
_Avoid_: Slash message, slash text

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
A per-Chat free-form exchange with the bot. Exactly one Conversation exists
in a Chat once anyone has posted eligible text. A Wake message opens it if it
is closed, joins the speaker as a Participant, and logs the Wake as a Turn.
Ordinary text is a Turn even while it is closed; that closed log stays at the
latest 100 Turns. While it is open the log may grow. Other Members join the
same Conversation with a Wake. Everyone's text is shared context, labeled by
speaker. Only Participants get a reply. The last Participant's Stop message
closes it, snaps the log to the latest 100 Turns, and leaves Participants
empty. Not a Mark and not the Stats command.
_Avoid_: Session, Dialogflow session, private log, isolated thread

**Participant**:
A Member who joined the Chat's open Conversation by a Wake message. Later
text without the Wake token stays a Turn and gets a reply until they Stop.
A Member who has not joined is background: their text is still a Turn, they
get no reply.
_Avoid_: Session owner, speaker, user

**Wake message**:
A text message that opens the Chat's Conversation if it is closed (creating
it if needed), joins the speaker as a Participant, and logs the whole message
as a Turn. After trim, the first whitespace-separated token is exactly `бот`
— that spelling, that case. `Бот` does not wake. `ботан` does not wake. The
whole message is one Turn. Repeating Wake while already a Participant is just
another Turn.
_Avoid_: Mention, command, trigger, case-insensitive бот

**Stop message**:
A text message that leaves a Conversation. After trim, the entire text is
exactly `довольно` — that spelling, that case. It is not a Turn. If the
speaker is a Participant they leave and the bot thumbs-up; if they were the
last Participant, the Conversation closes. If they are not a Participant:
silence, no reaction, not a Turn.
_Avoid_: Cancel, exit, Довольно, довольно with extra words

**Turn**:
A text message that becomes part of the Chat's Conversation log. Member Turns
reach the model as `[label] text`, with `label` frozen at write time from the
Telegram first name, case kept as is. Assistant Turns are the posted reply,
unlabeled. Wake messages are Turns. Ordinary text is a Turn while the
Conversation is closed as well as while it is open. Commands, Scoring replies,
Stop messages, and non-text messages are not.
_Avoid_: Prompt, utterance, LLM call
