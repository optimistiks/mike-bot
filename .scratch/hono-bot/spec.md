# Hono v2 Telegram bot

Status: ready-for-agent

## Problem Statement

The live v1 bot still runs on AWS with Telegraf, DynamoDB, and Dialogflow. The v2
branch grew a Next.js Mini App, Scoring reactions, Seasons, and Registration —
none of which should be the product now. Members still need the bot they already
know: Scoring replies, in-Chat Standings, and talking to the bot until they say
stop. Dialogflow has to go. The Mini App stays in the repo unused.

## Solution

A new Hono app on Vercel is the Telegram bot. It matches v1 for Scoring replies
and for the Stats command. Free-form talk is a Conversation: a Wake message
opens it, Turns go to a model with history, a Stop message closes it in silence.
v1 history lands through a DynamoDB-to-JSON package and a load into a fresh
Postgres. The Next.js app is frozen source. Its glossary and ADRs are archived.

## User Stories

1. As a Member, I want to reply `+` to someone else's Message, so that they gain
   Karma plus and the Chat sees who gave it.
2. As a Member, I want to reply `-` to someone else's Message, so that they gain
   Karma minus and the Chat sees who gave it.
3. As a Member, I want to reply `лол` to someone else's Message, so that they
   gain a Humor Mark and the Chat sees who gave it.
4. As a Member, I want `ЛОЛ` and `Лол` to count as a Humor Mark, so that I do
   not have to match a keyboard case.
5. As a Member, I want a Scoring reply with stray spaces around the token to
   still count, so that a sloppy `+` still lands.
6. As an Actor, I want my Scoring reply deleted and replaced under the marked
   Message with `➕ (name)`, `➖ (name)`, or `лол (name)`, so that the Chat can
   see the Mark landed and who gave it without a mention notification.
7. As an Actor, I want my Display name in that answer to be my Telegram username,
   or `???` if I have none, so that the answer matches v1.
8. As a Subject, I do not want to be marked by my own Scoring reply, so that
   self-scoring is impossible.
9. As a Member, I do not want a bot's Message to receive a Mark, so that bots
   are never Subjects.
10. As a Member, I want a `+`, `-`, or `лол` that is not a reply to do nothing,
    so that a lone token in the Chat is not a Mark.
11. As an Actor, I want only one Karma Mark per Message I score, so that I
    cannot give both Karma plus and Karma minus on the same Message.
12. As an Actor, I want one Humor Mark on a Message to be independent of my
    Karma Mark on that Message, so that I can still `лол` after a `+`.
13. As an Actor, I want a second Scoring reply in a spent Mark slot left in the
    Chat with no bot answer, so that a repeat is visibly ignored the way v1 did.
14. As a Member, I want a Scoring reply itself to be unmarked, so that reacting
    or replying `+` to the bot's answer or to the original token does nothing
    useful — the token is gone, and the bot's answer is not a Message that
    receives Marks.
15. As a Member, I want `/stats` in a Chat that has Marks to print Standings in
    that Chat and delete the command, so that I see all-time ranking without
    leaving Telegram.
16. As a Member, I want `/stats` in a Chat with no Marks to do nothing and leave
    the command, so that an empty Chat stays quiet.
17. As a Member, I want Standings in this order — Уважаемые люди, Юмористы,
    Поставили ➕, Поставили ➖, Поставили лол — so that the Chat matches v1.
18. As a Member, I want everyone who ever gave or received a Mark in that Chat
    to appear in every Standings section, zeros included, so that the list is
    the same people throughout.
19. As a Member, I want Crown on every Member tied for the highest Karma
    received, so that the top of Уважаемые люди is marked.
20. As a Member, I want Chicken on every Member tied for the lowest Karma
    received when someone else is strictly higher, so that the bottom of
    Уважаемые люди is marked.
21. As a Member, I want the same Crown and Chicken rules on Юмористы after Humor
    decay, so that humor ranking flair matches v1.
22. As a Member, I do not want Crown or Chicken on the three given-sections, so
    that those lists stay plain counts.
23. As a Member, I want Юмористы to apply v1 Humor decay at display time, so
    that humor ranking matches the old bot without changing stored Marks.
24. As a Member, I want Standings to print each Member's latest Display name, so
    that a renamed Member is not listed under a stale username.
25. As a Member, I want `/stats` to work while I have an open Conversation, so
    that asking for Standings does not become a Turn and does not close the
    Conversation.
26. As a Member, I want to say `бот` and have the bot answer, so that a
    Conversation opens and the first Turn is that message as-is.
27. As a Member, I want `бот привет` to open a Conversation and send the whole
    text to the model, so that the wake token plus the rest is one Turn.
28. As a Member, I want `Бот` not to wake the bot, so that wake is exact and
    case-sensitive.
29. As a Member, I want `ботан` not to wake the bot, so that only the token
    `бот` starts a Conversation.
30. As a Member, I want every later text message of mine in that Chat to be a
    Turn without repeating `бот`, so that I can talk normally until I stop.
31. As a Member, I want the model to see every Turn in this Conversation in
    order, so that it has context.
32. As a Member, I want the bot to sound like a dead-inside millennial gopnik
    (short answers like `че`), so that talk feels like the old group bot, not
    a helpdesk.
33. As a Member, I want `довольно` to close my Conversation with no reply, so
    that stopping is silent.
34. As a Member, I want `Довольно` or `довольно, спасибо` not to stop, so that
    only exact `довольно` closes.
35. As a Member, I want nothing I say after `довольно` to get a bot reply until
    I wake it again, so that a closed Conversation stays closed.
36. As a Member, I want a new Wake after Stop to start a fresh Conversation with
    empty context, so that old talk does not leak in.
37. As a Member, I want my Conversation to stay open across days with no expiry,
    so that I do not have to wake the bot again after a pause.
38. As a Member in a Chat with two other Members talking to the bot, I want my
    Turns isolated from theirs, so that three Conversations can run at once.
39. As a Member with an open Conversation, I want a Scoring reply to still place
    a Mark and not become a Turn, so that scoring is never swallowed by talk.
40. As a Member with an open Conversation, I want any Command to not be a Turn,
    so that `/stats` and unknown commands do not go to the model.
41. As a Member with an open Conversation, I want stickers, photos, and other
    non-text to be ignored, so that only text is a Turn.
42. As a Member, I want a photo caption not to count as a Wake or a Turn, so
    that only real text messages talk to the bot.
43. As a Member, I want the bot to stay silent if the model fails, so that an
    outage does not dump an error into the Chat.
44. As a Member in a private Chat, I want Scoring, Standings, and Conversations
    to work the same as in a group, so that chat type is not a gate.
45. As a Member in a channel, I want the same: no chat-type filter.
46. As a maintainer, I want to scan v1 DynamoDB into a JSON file of v1 lol rows
    without touching Postgres, so that export is a separate, repeatable step.
47. As a maintainer, I want a load of that JSON into the Hono app's database, so
    that Imported Marks, Members, and Messages exist for Standings.
48. As a maintainer, I want a v1 Message's post time to be the earliest Imported
    Mark on it, so that import is best-effort the way the archived Message
    cache was.
49. As a maintainer, I want repeat v1 Marks on the same slot to keep the
    earliest and drop the rest, so that live slot rules also hold for history.
50. As a maintainer, I want a fresh Neon database and new migrations, so that
    Mini App tables are not a compatibility target.
51. As a maintainer, I want Telegram retries of the same update not to double a
    Mark or a Turn, so that webhook redelivery is safe.
52. As a maintainer, I want the Next.js Mini App source to remain in the
    workspace unused, so that we can thaw it later without it owning the
    webhook.
53. As a Member, I do not want Scoring reactions, Undo, `/addreaction`, Seasons,
    Registration, or a Mini App link from `/stats`, so that this bot is v1 plus
    Conversations, not the frozen v2 surface.

## Implementation Decisions

- Live product is a Hono Telegram bot on Vercel. `apps/web` stays frozen. Root
  `CONTEXT.md` and `docs/adr/` are the live model; Next.js Mini App docs live
  under `docs/archive/nextjs-v2/` (ADR-0001).
- Three deep modules behind one update handler: Scoring, Standings,
  Conversation. Hono and grammY authenticate the webhook, parse the Telegram
  update, call the handler, and perform side effects (delete, reply) from the
  outcome. They do not contain scoring, standings, or conversation rules.
- Outcome types (locked in grilling):

  ```ts
  type ScoringOutcome =
    | { kind: "accepted"; text: string }
    | { kind: "ignored" };

  type StandingsOutcome =
    | { kind: "posted"; text: string }
    | { kind: "empty" };

  type ConversationOutcome =
    | { kind: "reply"; text: string }
    | { kind: "silence" };
  ```

  Accepted Scoring: delete the Scoring reply, reply `text` to the marked
  Message. Posted Standings: delete the Stats command, send Markdown.
  Empty Standings: delete nothing, say nothing. Conversation reply: reply to
  the Member's message. Silence: send nothing (Stop, closed, Command, non-text,
  model failure).
- Routing order for a text message: Command (Stats command vs other Commands)
  → Scoring reply → Conversation. Scoring replies and Commands are never Turns.
- Scoring reply tokens: trimmed exact `+` / `-`, trimmed `лол` with case folded
  the v1 way (`toLowerCase` after trim). No other tokens.
- Self-scoring and bot Subjects refused (`ignored`). Missing reply_to refused.
  Spent Mark slot refused and left in the Chat.
- Acknowledgement text: `➕ (name)`, `➖ (name)`, `лол (name)` with U+2795 /
  U+2796. Name is the username on that Scoring reply, or `???`. Not an
  @mention.
- Mark types: `karma.plus`, `karma.minus`, `humor.add`. One Karma slot and one
  Humor slot per Actor per Message, uniqueness on (Chat, Actor, Message, slot).
- Schema, fresh, no Mini App migrations: `members` (Telegram id, latest
  username), `messages` (Chat id, message id, author id, post time), `marks`,
  plus Conversation persistence and webhook `update_id` idempotency. No
  reaction tables, no Registration, no Seasons.
- Display name for Standings: latest username on `members`, or `???`. One name
  per Member, not per Chat. Upsert whenever a Member is seen. Scoring-reply
  answers still use the username on that Telegram message.
- Message rows: written from the reply target on a live Scoring reply; on
  import, one Message per (Chat, message id), post time = earliest Imported
  Mark on it (Telegram-second truncation). Do not overwrite an existing author.
- Stats command: all-time Standings for that Chat. Byte-level v1 Markdown,
  including Humor decay. Decay is display-only: sort by raw Humor received
  descending; for index `i` of `n` people, subtract
  `round(humor * ((n - i - 1) * (40 / n) / 100))`; re-sort by decayed Humor;
  then print. Crown/Chicken only on Karma received and Humor received. Given
  sections have no flair. Everyone who gave or received a Mark is in every
  section, zeros included. Empty Chat → `empty`.
- Wake message: after trim, first whitespace-separated token is exactly `бот`
  (case-sensitive). Whole message is one Turn, forwarded as-is. Bot answers
  via the model, not a canned string.
- Stop message: after trim, entire text is exactly `довольно`
  (case-sensitive). Not a Turn. `silence`. Later text is `silence` until a
  new Wake. No expiry. Next Wake is a new Conversation with empty history.
- Conversation isolation: (Member, Chat). History is every Turn until Stop;
  drop oldest if the model context window fills. No tools. No Standings access.
- Model: Vercel AI SDK `generateText` through AI Gateway, one named free-tier
  model constant. Not Chat SDK. System prompt: dead-inside millennial gopnik;
  short replies. Failure → `silence`.
- Commands: anything Telegram marks as a bot command. Stats command still
  prints Standings. Other Commands are not Turns and produce no extra reply
  beyond whatever that Command already does (unknown Commands: nothing).
- No `chat.type` filter.
- Import: package `v1-export` scans DynamoDB and writes validated v1 lol-row
  JSON. It does not know Postgres. A script in the Hono app loads JSON into
  `members`, `messages`, and `marks`. Earliest Mark per slot wins. Latest
  username seen in the file wins on `members`.
- Hosting: own Vercel project, grammY `std/http` webhook, Fluid compute, Neon
  pooled TCP via `pg` and `attachDatabasePool`. Unpooled URL for migrations and
  import. Tests and local: PGlite, same schema, new migrations only.
- Tooling for the Hono app: latest packages, oxfmt, oxlint with the strictest
  type-aware ruleset (`typeAware`, including typescript-eslint-equivalent
  type-aware rules). `apps/web` keeps prettier/eslint. Root fmt that still runs
  prettier must not fight oxfmt in the Hono app.
- Exactly ten tests at the start. Not one more.

## Testing Decisions

A good test asserts what the Chat would see: outcome `kind` and `text`, whether
a Mark exists, whether a Conversation is open, whether another Member's
context is untouched. It does not assert SQL shape, prompt strings beyond
behaviour, or Hono routing.

One seam: the update handler (the function that takes a Telegram update plus
database and model ports and returns the outcomes the adapter will send). The
three modules sit behind it. Tests do not call Hono. Tests do not call grammY
send APIs directly.

MSW fakes the model HTTP. Database is PGlite.

The ten tests, and only these:

1. Scoring: `+` → `accepted` with `➕ (name)`, Mark stored, token to-delete.
2. Scoring: `лол` → `accepted` with `лол (name)`, Humor Mark stored.
3. Scoring: self / bot Subject / missing reply → `ignored`, no Mark.
4. Scoring: second `+` on the same Message → `ignored`, Chat token left.
5. Standings: fixture of Marks → `posted` Markdown matching v1 (titles, zeros,
   Humor decay, Crown/Chicken only on the first two sections, latest Display
   names).
6. Standings: Chat with no Marks → `empty` (command not deleted).
7. Conversation: Wake `бот` → model called with that text as-is, `reply`.
8. Conversation: after Wake, further text without `бот` → `reply`, history
   includes the prior Turn.
9. Conversation: `довольно` → `silence`; a later text → `silence`.
10. Conversation: two Members isolated in one Chat, and a Scoring reply during
    an open Conversation is `accepted` as Scoring and is not a Turn.

Prior art: v1 behaviour on `origin/master` (`+`/`-`/`лол`, `/stats`, Dialogflow
catch-all). Frozen v2 reply acknowledgement text is a cherry-pick of the
delete-and-answer wording only.

## Out of Scope

- Mini App, Registration, `/register`, Leaderboards UI, Cache Components
- Scoring reactions, Undo window, Reaction bindings, `/addreaction`
- Seasons, yearly Standings, ten-minute grace
- Amazon Polly / `/s`
- Dialogflow intents, Dialogflow sessions, Google credentials
- Group-to-supergroup history migration
- Sharing the Mini App database or its migrations
- More than ten tests in the first delivery
- Streaming model replies, tools, Standings-aware talk
- Hard-coded `че` (persona is the system prompt, not a canned Wake answer)

## Further Notes

Wake and Stop are case-sensitive; `лол` is not. That is deliberate v1-plus-new
Conversation behaviour.

v1 Standings names followed DynamoDB scan order. This spec uses latest Display
name on `members` instead, which is deterministic.

v1 Dialogflow was a catch-all on leftover messages with a session that never
ended. Conversations here are opt-in with Wake/Stop. Do not reintroduce a
catch-all.

The test seam is the update handler, not the three module functions and not the
HTTP webhook. If that is the wrong height, say so before implementation.
