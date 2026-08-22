# Mike-bot

A Telegram group scoring bot where Members mark each other's messages and compare Karma and Humor over
Seasons and years.

## Scoring

**Mark**:
An eligible scoring choice that an Actor applies to a different Member's Message through a Scoring reaction or Scoring reply. The Message's author is the Mark's Subject. At most one Mark of each kind is active for one Chat, Actor, and Message, while historical Events remain unlimited.
_Avoid_: Vote, rating

**Active Mark**:
The latest addition of one Mark kind for a Chat, Actor, and Message that no reversal Event references. Karma plus and Karma minus are independent Active Marks and may coexist.
_Avoid_: Unique Event, current reaction

**Scoring action**:
An Actor's attempt to add or remove a Mark, whether by Scoring reaction or Scoring reply. Its Telegram timestamp, not the moment Mike-bot processes it, decides whether it is still eligible for the Message's Season.
_Avoid_: Webhook update, request

**Scoring reaction**:
One of the Telegram reactions through which a Member expresses a Mark: 👍 for Karma plus, 👎 for Karma minus, or 🤣 for a Humor Mark. Removing it reverses the Mark.
_Avoid_: Emoji, vote

**Scoring reply**:
An exact trimmed `+`, `-`, or case-insensitive `лол` reply that permanently expresses the corresponding Mark. A Scoring reply remains in the Chat, is acknowledged with a 👍 reaction, and cannot be undone.
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
A Member's net total, over one Leaderboard period, of received Karma plus and Karma minus Marks and their reversals.
_Avoid_: Carma, score, respect

**Humor**:
A Member's net total, over one Leaderboard period, of received Humor Marks and their reversals.
_Avoid_: Lol score, humor points

**Actor**:
The Member who applies or removes a Mark.
_Avoid_: Giver, reactor

**Subject**:
The Member whose message receives the Mark.
_Avoid_: Recipient, target

**Event**:
An immutable canonical fact of type `karma.plus`, `karma.minus`, or `humor.add`. An addition stands alone; reversing a Mark appends a same-type reversal Event that names the exact addition it undoes and inverts its scoring contribution. Only Scoring reaction additions are reversible.
_Avoid_: Mark

**Imported Event**:
An Event reconciled from v1, Mike-bot's retired AWS-hosted predecessor. It is never reversible and keeps its v1 timestamp for Season attribution.
_Avoid_: Legacy row, migration

## Community and access

**Chat**:
A Telegram group or supergroup whose Marks, Display identities, Registrations, and Leaderboards are isolated from every other Chat. The same Member may participate in more than one Chat. Mike-bot mirrors the Chat's Telegram title and photo reference to present it, and owns neither.
_Avoid_: Room

**Member**:
A non-bot person identified by their stable Telegram identity.
_Avoid_: User, account

**Display identity**:
The latest known name used to present a Member within one Chat.
_Avoid_: Chat member, username

**Message**:
The cached Telegram identity, author, bot status, and post time of a message that may receive Marks. Mike-bot stores no Message content, and a Message it never observed cannot be marked by reaction. An imported Message's post time is a best-effort estimate from the earliest Event that marked it.
_Avoid_: Event, post content

**Registration**:
A Member's authorization to view one Chat in the Mini App. It begins when the Member invokes the Stats command inside that Chat, and ends when the Member leaves or is removed from the Chat.
_Avoid_: Chat membership, participation

**Register command**:
The `/register` command, an alias of the Stats command usable by any Member.
_Avoid_: Signup, invite

## Leaderboards

**Season**:
A calendar month in `Europe/Moscow` to which live Events are credited according to the marked Message's post time. A Scoring action stays eligible for ten minutes after the Season's calendar end; a later one has no effect on it. Imported Events are credited by their v1 timestamp instead.
_Avoid_: Rolling window

**Leaderboard period**:
Either one Season or one calendar year over which a Leaderboard ranks Members. A yearly period combines the Events already credited to its twelve Seasons.
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
The `/stats` command that opens the Mini App. In a Chat it also establishes Registration and links directly to that Chat's current Leaderboard, replying ephemerally so only the caller sees it; privately it opens the Chat selector.
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
