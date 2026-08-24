# Mike-bot

A Telegram group scoring bot where Members mark each other's messages and compare Karma and Humor over
Seasons and years.

## Scoring

**Mark**:
An eligible scoring choice that an Actor applies to a different Member's Message through a Scoring reaction or Scoring reply. The Message's author is the Mark's Subject. A Mark spends a Mark slot, is permanent once the Undo window closes, and cannot be joined by a second Mark in the same slot.
_Avoid_: Vote, rating, Event

**Mark slot**:
One of the two grants an Actor holds for every other Member's Message: `karma`, spendable as Karma plus or Karma minus but never both, and `humor`, independent of it. A Mark spends its slot, whichever input placed it.
_Avoid_: Kind, category, budget

**Undo window**:
The five seconds after a Scoring reaction's Mark during which removing that reaction deletes the Mark and refunds its slot. Telegram's own timestamps for the two actions decide, not the moment Mike-bot processes them. Once it closes the Mark is permanent, and reaction removal has no effect. Scoring replies never have one.
_Avoid_: Grace period, cooldown, undo period

**Scoring action**:
An Actor's attempt to add or remove a Mark, whether by Scoring reaction or Scoring reply. Its Telegram timestamp, not the moment Mike-bot processes it, decides whether it is still eligible for the Message's Season.
_Avoid_: Webhook update, request

**Scoring reaction**:
One of the Telegram reactions through which a Member expresses a Mark: 👍 for Karma plus, 👎 for Karma minus, or 🤣 for a Humor Mark. Removing it takes the Mark back only inside the Undo window. Once that window closes the reaction Telegram displays and the Mark Mike-bot holds can disagree — switching 👍 to 👎 an hour later leaves 👎 on screen and Karma plus in the Leaderboard — and nothing in the Chat says so.
_Avoid_: Emoji, vote

**Scoring reply**:
An exact trimmed `+`, `-`, or case-insensitive `лол` reply that permanently expresses the corresponding Mark. The bot deletes an accepted Scoring reply and answers under the marked Message in its place — `➕`, `➖`, or `лол` followed by the Actor's un-mentioned name. A reply whose slot is already spent is left in the Chat untouched and unanswered. A Scoring reply is never itself a Message: neither it nor the bot's answer can be marked, so reacting to either does nothing. Editing a message into a Scoring token after the fact does nothing either.
_Avoid_: Legacy reply, command

**Karma plus**:
A kind of Mark that contributes one positive point to the Subject's Karma.
_Avoid_: Upvote, plus, positive vote

**Karma minus**:
A kind of Mark that contributes one negative point to the Subject's Karma.
_Avoid_: Downvote, minus, negative vote

**Humor Mark**:
A kind of Mark that contributes one point to the Subject's Humor.
_Avoid_: Lol, joke vote

**Karma**:
A Member's net total, over one Leaderboard period, of received Karma plus and Karma minus Marks.
_Avoid_: Carma, score, respect

**Humor**:
A Member's total, over one Leaderboard period, of received Humor Marks.
_Avoid_: Lol score, humor points

**Actor**:
The Member who applies or removes a Mark.
_Avoid_: Giver, reactor

**Subject**:
The Member whose message receives the Mark.
_Avoid_: Recipient, target

**Mark type**:
The canonical value a Mark carries: `karma.plus`, `karma.minus`, or `humor.add`. Its Mark slot follows from it.
_Avoid_: Event type, kind

**Imported Mark**:
A Mark reconciled from v1, Mike-bot's retired AWS-hosted predecessor. v1 knew only Scoring replies, so an Imported Mark is one, and is therefore permanent like any other. It keeps its v1 timestamp for Season attribution, which is the only thing that distinguishes it — nothing else in the model treats it specially. v1 allowed a Member to mark one Message repeatedly, so the import admits only the earliest Mark per slot.
_Avoid_: Legacy row, migration

## Community and access

**Chat**:
A Telegram supergroup whose Marks, Display identities, Registrations, and Leaderboards are isolated from every other Chat. The same Member may participate in more than one Chat. Mike-bot mirrors the Chat's Telegram title and photo reference to present it, and owns neither. Mike-bot ignores every other kind of Telegram chat, and does not carry a Chat's history across a Telegram upgrade from a plain group: the upgraded supergroup has a different id and starts empty (ADR-0016).
_Avoid_: Room, group

**Member**:
A non-bot person identified by their stable Telegram identity.
_Avoid_: User, account

**Display identity**:
The latest known name used to present a Member within one Chat. Their Telegram profile photo is shown beside it where Telegram will serve one, and is never stored — initials stand in otherwise.
_Avoid_: Chat member, username

**Message**:
The cached Telegram identity, author, bot status, and post time of a message that may receive Marks. A Scoring reaction carries neither the author nor the post time, so Mike-bot caches both when it first sees the message; a Message it never observed cannot be marked by reaction. Mike-bot stores no Message content. An imported Message's post time is a best-effort estimate from the earliest Mark on it.
_Avoid_: Post content

**Registration**:
A Member's authorization to view one Chat in the Mini App. It begins when the Member invokes the Stats command inside that Chat, and ends when the Member leaves or is removed from the Chat.
_Avoid_: Chat membership, participation

**Register command**:
The `/register` command, an alias of the Stats command usable by any Member.
_Avoid_: Signup, invite

## Leaderboards

**Season**:
A calendar month in `Europe/Moscow` to which live Marks are credited according to the marked Message's post time. A Scoring action stays eligible for ten minutes after the Season's calendar end; a later one has no effect on it. Imported Marks are credited by their v1 timestamp instead.
_Avoid_: Rolling window

**Leaderboard period**:
Either one Season or one calendar year over which a Leaderboard ranks Members. A yearly period combines the Marks already credited to its twelve Seasons.
_Avoid_: Season when referring to a year, time range

**Current Season**:
The Season containing the present time in `Europe/Moscow`.
_Avoid_: Ongoing season

**Leaderboard**:
The ranking of one Chat for one Leaderboard period, presented as five Leaderboard sections.
_Avoid_: Stats, scoreboard

**Leaderboard section**:
One of a Leaderboard's five rankings, always in this order: Karma received (Уважаемые люди), Humor received (Юмористы), Karma plus given (На позитиве), Humor given (Хотят смеяться 5 минут), Karma minus given (Как же у них горит). A Member with a zero total is left out of a section.
_Avoid_: Category, tab, board

**Stats command**:
The `/stats` command that opens the Mini App. Called in a Chat it establishes Registration and links directly to that Chat's current Leaderboard, replying ephemerally so only the caller sees it. Called anywhere else it does nothing at all — Registration is authorization to view one Chat, so it has nothing to mean outside one, and the Chat selector is reached by launching the Mini App.
_Avoid_: Stats question, report

**Crown**:
Flair awarded to every Member tied for the highest total in a Leaderboard section.
_Avoid_: Winner badge

**Chicken**:
Flair awarded to every Member tied for the lowest total in a Leaderboard section when at least one Member has a strictly higher total.
_Avoid_: Loser badge

**Mini App**:
The Telegram interface through which a registered Member selects a Chat and views its Leaderboards.
_Avoid_: Stats page
