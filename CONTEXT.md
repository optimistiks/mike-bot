# Mike-bot

A Telegram group scoring bot: members mark each other's messages, and a Mini App shows honest seasonal leaderboards.

## Language

**Karma**:
A member's net score from Karma plus minus Karma minus. An integer, no decay.
_Avoid_: carma, score, уважение

**Karma plus**:
The scoring reaction that adds 1 Karma to the message author.
_Avoid_: plus, +, ➕ as the concept name (those are v1 triggers)

**Karma minus**:
The scoring reaction that subtracts 1 Karma from the message author.
_Avoid_: minus, −, ➖ as the concept name

**Humor**:
Points a member receives when someone puts the Humor scoring reaction on their message. An integer, no decay.
_Avoid_: lol, лол, humor points as a separate type from Humor

**Scoring reaction**:
One of the three configured Telegram reactions: Karma plus, Karma minus, or Humor.
_Avoid_: vote, emoji (too vague), лол

**Mark**:
One member applying a scoring reaction to another member's message. Removing the reaction undoes the Mark.
_Avoid_: lol record, vote, lol

**Member**:
A non-bot Telegram user. Members cannot Mark themselves or bots.
_Avoid_: user, account (prefer Member in this domain)

**Season**:
A calendar month inside a calendar year (e.g. 2026-08). Marks belong to the Season in which they were made.
_Avoid_: period, window

**Current Season**:
The Season for today's year and month. The Mini App must show it as the live season (UI copy may say "Ongoing season").
_Avoid_: treating "ongoing" as a different kind of Season

**Mini App**:
The Telegram Mini App that shows honest Karma and Humor leaderboards by Season, including v1 history.
_Avoid_: stats command, /stats

**v1**:
The AWS Lambda Telegraf bot on `master`. It scored via reply text (`+`, `-`, `лол`) and stored Marks in DynamoDB.
_Avoid_: old bot, legacy bot as glossary terms (say v1)
