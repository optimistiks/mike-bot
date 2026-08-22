# Mike-bot

A Telegram group scoring bot where Members mark each other's messages and compare seasonal Karma and Humor.

## Scoring

**Mark**:
An eligible scoring choice that an Actor applies to a different Member's message through a Scoring reaction. The message's author is the Mark's Subject.
_Avoid_: Vote, rating

**Scoring reaction**:
One of the Telegram reactions through which a Member expresses a Mark: 👍 for Karma plus, 👎 for Karma minus, or 🤣 for a Humor Mark.
_Avoid_: Emoji, vote

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
An immutable fact that an eligible Mark was applied or removed. Removing a Mark produces a compensating Event rather than changing the earlier Event.
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

**Registration**:
A Member's authorization to view one Chat in the Mini App. It begins through a Registration message, survives removal of the registration reaction, and ends when the Member leaves or is removed from the Chat.
_Avoid_: Chat membership, participation

**Registration message**:
A bot-authored message through which a Member can establish Registration by adding a reaction.
_Avoid_: Registration post

## Leaderboards

**Season**:
A calendar month in `Europe/Moscow` to which eligible Events are credited according to the marked message's timestamp. Reaction actions remain eligible for ten minutes after its calendar end; actions timestamped later cannot affect it.
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

**Stats question**:
Free-form text following the `/stats` command through which a Member asks for Chat-scoped scoring information.
_Avoid_: Prompt, query

**Stats report**:
A Chat-scoped answer to a Stats question over a resolved set of Members, scoring categories, and time range.
_Avoid_: Leaderboard, analysis

**Crown**:
Flair awarded to every Member tied for the highest total in a Leaderboard section.
_Avoid_: Winner badge

**Chicken**:
Flair awarded to every Member tied for the lowest total in a Leaderboard section when at least one Member has a strictly higher total.
_Avoid_: Loser badge

**Mini App**:
The Telegram interface through which a registered Member selects a Chat and views its Leaderboards.
_Avoid_: Stats page
