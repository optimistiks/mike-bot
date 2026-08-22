# Mike-bot

A Telegram group scoring bot where Members mark each other's messages and compare seasonal Karma and Humor.

## Scoring

**Mark**:
An eligible scoring choice that an Actor applies to a different Member's Message through a Scoring reaction or Scoring reply. The Message's author is the Mark's Subject. At most one Mark of each kind is active for one Chat, Actor, and Message, while historical Events remain unlimited.
_Avoid_: Vote, rating

**Active Mark**:
The latest addition of one Mark kind for a Chat, Actor, and Message that no reversal Event references. Karma plus and Karma minus are independent Active Marks and may coexist.
_Avoid_: Unique Event, current reaction

**Scoring reaction**:
One of the Telegram reactions through which a Member expresses a Mark: 👍 for Karma plus, 👎 for Karma minus, or 🤣 for a Humor Mark.
_Avoid_: Emoji, vote

**Scoring reply**:
An exact trimmed `+`, `-`, or case-insensitive `лол` reply that permanently expresses the corresponding Mark. A Scoring reply remains in the Chat and cannot be undone by removing a reaction.
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
A Member's net seasonal total from received Karma plus and Karma minus Marks and their reversals.
_Avoid_: Carma, score, respect

**Humor**:
A Member's net seasonal total from received Humor Marks and their reversals. Humor does not decay.
_Avoid_: Lol score, humor points

**Actor**:
The Member who applies or removes a Mark.
_Avoid_: Giver, reactor

**Subject**:
The Member whose message receives the Mark.
_Avoid_: Recipient, target

**Event**:
An immutable canonical fact of type `karma.plus`, `karma.minus`, or `humor.add`. An addition Event has no reversal pointer. Removing a reversible reaction appends a same-type Event whose `reversesEventId` identifies the exact addition and whose scoring contribution is inverted. Reply and imported additions are not reversible.
_Avoid_: Mark

## Community and access

**Chat**:
A Telegram group or supergroup whose Marks, Display identities, Registrations, and leaderboards are isolated from every other Chat. The same Member may participate in more than one Chat.
_Avoid_: Room

**Member**:
A non-bot person identified by their stable Telegram identity.
_Avoid_: User, account

**Display identity**:
The latest known name used to present a Member within one Chat.
_Avoid_: Chat member, username

**Message**:
The cached Telegram identity, author, bot status, and second-precision date of a message that may receive Marks. Mike-bot stores no Message content. Imported Message dates are best-effort estimates from the earliest associated v1 Event.
_Avoid_: Event, post content

**Registration**:
A Member's authorization to view one Chat in the Mini App. It begins through a Registration message reaction or the Member's group `/stats` command, survives removal of the registration reaction, and ends when the Member leaves or is removed from the Chat.
_Avoid_: Chat membership, participation

**Registration message**:
A bot-authored message through which a Member can establish Registration by adding a reaction.
_Avoid_: Registration post

## Leaderboards

**Season**:
A calendar month in `Europe/Moscow` to which live Events are credited according to the marked Message's timestamp. Reaction actions remain eligible for ten minutes after its calendar end; actions timestamped later cannot affect it. Imported Events retain their historical v1 Event timestamp for Season attribution despite their estimated Message date.
_Avoid_: Rolling window

**Leaderboard period**:
Either one Season or one calendar year over which a Leaderboard ranks Members. A yearly period combines the Events already credited to its twelve Seasons.
_Avoid_: Season when referring to a year, time range

**Current Season**:
The Season containing the present time in `Europe/Moscow`.
_Avoid_: Ongoing season

**Leaderboard**:
A ranking for one Leaderboard period of non-zero Member totals across Karma received, Humor received, Karma plus given, Karma minus given, and Humor Marks given.
_Avoid_: Stats, scoreboard

**Stats command**:
The `/stats` command that opens the Mini App. In a Chat it also establishes Registration and links directly to that Chat's current Leaderboard; privately it opens the Chat selector.
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
