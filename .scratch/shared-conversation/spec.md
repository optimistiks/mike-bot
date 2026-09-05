# Shared Conversation

Status: ready-for-agent

## Problem Statement

Members talk in a group Chat, but the bot only sees the Member who woke it.
Replies miss the thing that was just said to someone else. Several Members can
each hold a private Conversation in the same Chat, so the bot repeats itself
and cannot tell speakers apart. The model is also unbound: long answers, banned
persona-break phrases, missing timeouts, and overlapping calls for the same
Member.

## Solution

One Conversation per Chat. A Wake message activates it if needed, joins the
speaker as a Participant, logs the Wake as a Turn, and answers. Other Members
join the same Conversation the same way. Everyone's text while it is open is
context, labeled by speaker. Only Participants get a reply, always as a Telegram
reply to their message. The last Participant's Stop message closes it. Completions
are short, filtered, timed, and never queued twice for the same Participant.

## User Stories

1. As a Member, I want `бот` to activate a Conversation in this Chat and join
   me as a Participant, so that I can talk to the bot.
2. As a Member, I want `бот привет` to activate, join, log the whole text, and
   get a reply, so that the Wake token plus the rest is the first Turn.
3. As a Member, I want `Бот` not to wake or join, so that Wake stays
   case-sensitive.
4. As a Member, I want `ботан` not to wake or join, so that only the token `бот`
   as the first word counts.
5. As a Member in a Chat with no Conversation, I want my first Wake to both
   activate and join, so that I do not need two messages to start talking.
6. As a Member, I want later text without `бот` to stay a Turn and get a reply
   while I am a Participant, so that I can talk normally until I stop.
7. As a Member, I want `довольно` to leave the Conversation with no text reply
   and a thumbs-up reaction, so that stopping is visible and silent.
8. As a Member, I want `Довольно` or `довольно, спасибо` not to leave, so that
   only exact `довольно` is a Stop message.
9. As the last Participant, I want my `довольно` to close the Conversation, so
   that an empty Conversation does not stay open.
10. As a Member who is not a Participant, I want `довольно` to do nothing and
    not become a Turn, so that bystanders cannot close or pollute talk.
11. As a Member, I want nothing I say after I leave to get a bot reply until I
    Wake again, so that leaving sticks.
12. As a Member, I want a new Wake after the Conversation closed to start a
    fresh Conversation with empty context, so that old talk does not leak in.
13. As a Member, I want the Conversation to stay open across days with no
    expiry while any Participant remains, so that a pause is not a Stop.
14. As a second Member, I want `бот` or `бот ку` while a Conversation is already
    open to join that same Conversation and get a reply, so that we share one
    talk instead of opening another.
15. As a Participant who already joined, I want another `бот …` to stay a Turn
    and still get a reply, so that repeating the Wake token is just more talk.
16. As a Participant, I want the bot to see other Members' text in this Chat
    while the Conversation is open, so that "он опять сломался" has a referent.
17. As a Member who has not joined, I want my ordinary text logged as context
    and to get no reply, so that I am background until I Wake.
18. As a Participant, I want the bot to answer only my message, as a Telegram
    reply to that message, never a standalone Chat message, so that each
    Participant has their own reply thread.
19. As two Participants talking at once, I want each of us to get our own
    reply, so that one person's completion does not block the other's.
20. As a Participant, I want a second message of mine while my first completion
    is still in flight to be logged and not start another call, so that I do
    not get two overlapping answers.
21. As a Participant, I want the model to see Turns as `[name] text`, one
    inbound message per Chat message, so that it can tell speakers apart.
22. As a Participant, I want the bot's own replies unlabeled in that log, so
    that the model does not think it is another Member.
23. As a Participant, I want my speaker name frozen when the Turn is written,
    so that a later rename does not rewrite history.
24. As a Participant, I want the name to be my Telegram first name in
    lowercase, so that labels match how people are addressed in the Chat.
25. As a Participant, I want Scoring replies (`+`, `-`, `лол`) to still place
    Marks and never become Turns, so that scoring is not swallowed by talk.
26. As a Participant, I want Commands not to be Turns, so that `/stats` still
    prints Standings and unknown commands stay out of the model.
27. As a Member, I want stickers, photos, and captions ignored for
    Conversation, so that only real text is a Turn or a Wake.
28. As a Participant, I want the bot to stay silent if the model fails, so
    that an outage does not dump an error into the Chat.
29. As a Participant, I want a completion that takes longer than about eight
    seconds dropped with no late reply, so that a moved-on Chat is not
    interrupted.
30. As a Participant, I want empty or whitespace-only model text to be
    silence, so that a blank Turn is not posted or retried.
31. As a Participant, I want replies of at most two sentences, so that the bot
    does not dump a paragraph.
32. As a Participant, I want trailing periods stripped and no emoji or capital
    letters in the posted reply, so that punctuation matches the persona even
    when the model slips.
33. As a Participant, I want `я пошутил`, `если серьезно`, and `без обид` not
    to land as posted text, so that the bot does not break character.
34. As a Participant, I want those banned phrases retried at most twice on the
    same prompt, then cut from the match if they persist, so that a stubborn
    sample still does not post the break.
35. As a Participant, I want the model not to keep writing the next speaker's
    line, so that one reply is mine only.
36. As a Participant, I want few-shot examples in a fenced system-prompt block
    with generic `[уn]` speakers in the same `[label]` shape as live Turns, so
    that example names are not chat members and the transcript is only the
    real log.
37. As a Participant, I want a short reminder after the live log that I am the
    addressee, labeled `[:инструкция]` so it cannot be the last speaker, so
    that background names in the log are not who it answers.
38. As a maintainer, I want prompt prefix before the addressee reminder
    identical across Participants in the same Conversation, so that
    completions can share a cached prefix.
39. As a maintainer, I want history rolled forward in fixed blocks instead of
    dropping one Turn at a time, so that the prefix stays stable until a whole
    block falls off.
40. As a maintainer, I want temperature 1.0, max output 100 tokens, reasoning
    off, and the model id pinned, so that cost and latency stay bounded.
41. As a maintainer, I want each completion logged with the prompt, the text,
    and which filter fired, so that the banned list can grow from real output.
42. As a maintainer, I want Telegram retries of the same update not to double a
    Turn or a join, so that webhook redelivery stays safe.
43. As a Member in a private Chat, I want the same Wake, join, and Stop rules,
    so that chat type is not a gate.

## Implementation Decisions

- This spec supersedes the Hono-bot Conversation isolation rule (one
  Conversation per Member per Chat, isolated Turns). Isolation is who gets a
  reply (Participants only), not what the model sees. Update live `CONTEXT.md`
  Conversation, Wake, Stop, and Turn entries, and add Participant (a Member who
  joined the Chat's open Conversation by a Wake message). Avoid session.
- One open Conversation per Chat. Schema: Conversation keyed by Chat, with
  opened/closed time; Participants keyed by Conversation and Member; Turns
  belong to that Conversation (shared log), not to one Member. Replace the
  one-open-per-Member-Chat uniqueness with one-open-per-Chat.
- Wake message: after trim, first whitespace-separated token is exactly `бот`
  (case-sensitive). Activates if none is open, joins the speaker if not already
  a Participant, logs the whole message as a Turn, calls the model, replies.
  Repeating Wake while already a Participant is just another Turn.
- Stop message: after trim, entire text is exactly `довольно` (case-sensitive).
  Not a Turn. If the speaker is a Participant, they leave; outcome `closed` so
  the adapter can thumbs-up; if they were the last Participant, the Conversation
  closes. If they are not a Participant, silence, no reaction, not a Turn.
- Special tokens are one named group with different matchers: Wake (`бот` first
  token), Stop (exact `довольно`), Scoring replies (exact trimmed `+` / `-`,
  trimmed case-folded `лол`). Scoring replies and Commands are never Turns.
  Routing order unchanged: Command → Scoring reply → Conversation.
- Bystander text (not a special token, speaker not a Participant) is a Turn and
  `silence` (no model call).
- Adapter already replies to the Member's message and thumbs-up on `closed`.
  Keep both. Never send a standalone Conversation reply.
- Conversation outcome kinds stay `reply`, `closed`, `silence`.
- Model: Vercel AI SDK `generateText` through AI Gateway. Pin
  `zai/glm-5.3-flash`. `reasoning: "none"`. `temperature: 1.0`. Do not set
  `top_p` or frequency/presence penalties. Max output tokens 100. Stop sequences
  `\n\n` and `\n[`. Transport retries stay off. Wall clock for one `complete`
  including banned-phrase retries is ~8s; then abort and `silence`.
- Prompt order, every call: system (persona, suffix disclaimer, fenced
  few-shots) → live transcript → trailing user reminder. Nothing before the
  live transcript varies by Participant or by time (no timestamps, no ids).
  The trailing reminder is the only per-call suffix.
- System prompt is the structured group-chat persona (format, punctuation,
  behaviour, references) plus the four poorly/хорошо contrastive pairs as
  written, inserted before the section headers, then
  `[:инструкция] в конце лога — служебная реплика, не человек.`, then a
  fenced few-shot block. Do not invent more contrastive pairs in this pass.
- Few-shots live last in `instructions`, not in the message array. Fence:
  `примеры, не этот чат:`. The twelve examples from the raw-ideas draft, with
  глеб/дима/катя/саня mapped to reused `[у1]`–`[у4]`. Humans `[уn] text`,
  assistant lines bare, consecutive humans as separate lines. Deixis reply is
  `база`, not a vocative name. Live transcript uses the same `[label]`
  delimiter. Do not merge consecutive humans into one `user` string.
- Live member Turn text in the prompt is `[label] {raw}`. `label` is frozen at
  write time: Telegram `first_name` lowercased, colons stripped; if empty,
  username; if empty, `???`. Assistant Turns are unlabeled `assistant` content
  (the posted reply).
- Trailing user message, two lines, one `role: "user"` element: first line
  `[:инструкция] {format recap}` (at most two sentences, no trailing
  question, no persona-break phrases), then
  `отвечаешь только пользователю {label}` with that completion's speaker
  label (no extra brackets, no Russian inflection). The colon inside
  `[:инструкция]` cannot appear in a live `label` (`first_name` colons are
  stripped). Do not use a trailing `role: "system"` message.
- History cap 80k characters on the serialized live transcript. When over,
  drop the oldest 20k-character block, not one Turn at a time. Do not
  re-render old labels.
- In-flight: one completion per Participant. Always persist the Turn first. If
  that Participant already has a call in flight, skip `generateText` →
  `silence`. Other Participants may complete in parallel and share the log
  prefix. Timeout releases the lock.
- No per-Chat rate limit in this pass.
- Post-process, in order: if raw completion is empty/whitespace → `silence`,
  do not persist an assistant Turn, do not retry. Else banned-phrase loop
  (case-insensitive `я пошутил`, `если серьезно`, `без обид`): same prompt,
  new sample, at most two retries; after that, cut from the first match to
  the end; if nothing remains, `silence`. Then lowercase, strip emoji, keep
  the first two sentences (split on `.!?` and newlines), strip a trailing
  period. If a completion grows a labeled next line, truncate there. Persist
  and reply only when text remains.
- Do not strip trailing `?` as a bounce-back filter.
- Log one JSON line per completion attempt or skip: prompt, completion (null
  on skip), filters fired (`banned-phrase`, `retry`, `truncate-banned`,
  `lowercase`, `emoji`, `sentence-cap`, `empty`, `timeout`, `in-flight`, and
  label-truncate if used). Grow the banned list later from those logs, not
  from guesses.
- Model failure, timeout, in-flight skip, empty after filters → `silence`, no
  assistant Turn.

## Testing Decisions

A good test asserts what the Chat would see: outcome `kind` and `text`, whether
a Conversation is open, who is a Participant, whether a Mark exists, and which
labeled Turn texts reached the model. It does not assert SQL shape, Hono
routing, log lines, or cache-key bytes.

One seam: the update handler (Telegram update plus database and model ports,
returning the outcomes the adapter will send). Same seam as the Hono-bot suite.
Tests do not call Hono. Tests do not call grammY send APIs (thumbs-up and
`reply_parameters` stay in the adapter).

MSW fakes the model HTTP. Database is PGlite. Timeout, in-flight, and
banned-phrase tests stay on this seam by delaying or sequencing MSW responses
across overlapping handler calls.

Cap seventeen tests. Keep the six Scoring/Standings cases and update-id
idempotency. Rewrite the four Conversation cases and add six:

1. Scoring: `+` → `accepted` with `➕ (name)`, Mark stored, token to-delete.
2. Scoring: `лол` → `accepted` with `лол (name)`, Humor Mark stored.
3. Scoring: self / bot Subject / missing reply → `ignored`, no Mark.
4. Scoring: second `+` on the same Message → `ignored`, Chat token left.
5. Standings: fixture of Marks → `posted` Markdown matching v1.
6. Standings: Chat with no Marks → `empty`.
7. Conversation: Wake `бот` / `бот привет` → `reply`; model sees `[label]` plus
   the whole Wake text (not bare text).
8. Conversation: after Wake, further text without `бот` → `reply`; history
   includes the prior labeled Turn.
9. Conversation: Participant `довольно` → `closed`; later text from that Member
   → `silence` until a new Wake.
10. Conversation: Scoring reply during an open Conversation is `accepted` and
    is not a Turn; a second Member may join the same Conversation (no isolated
    private logs).
11. Idempotency: second delivery of the same `update_id` is ignored.
12. Bystander: Alice is a Participant, Bob (not joined) speaks → `silence` for
    Bob; Alice's next completion includes `[bob] …`.
13. Join: Bob sends `бот …` while Alice's Conversation is open → `reply` to
    Bob; the log already has Alice.
14. Empty/whitespace model text → `silence`, no assistant Turn.
15. Per-Participant lock: Alice's `complete` in flight, Bob (Participant)
    still gets a `reply`.
16. Model slower than ~8s → `silence`, no late `reply`.
17. Banned phrase in the sample → retry on the same prompt; after retries,
    posted text does not contain the banned span.

Prior art: Hono-bot update-handler suite (MSW `че`, PGlite, captured model
bodies for user Turn texts).

## Out of Scope

- Per-Chat rate limit
- Bounce-back trailing-`?` strip
- Guessing extra banned phrases; swapping contrastive BAD sides for live GLM
  failures
- Streaming, tools, Standings-aware talk
- Telegram history backfill from before the first Wake
- Russian vocative inflection
- Mini App, Scoring reactions, Seasons, Registration
- Changing Scoring or Standings rules except that they still never become Turns
- Raising the suite past seventeen tests

## Further Notes

Wake and Stop stay case-sensitive; `лол` does not. Scoring matchers stay as
they are; they are listed with Wake/Stop only so Conversation code can say
"special token" in one place.

`closed` exists so the adapter can thumbs-up. Tests assert `closed` from the
handler, not the Telegram reaction.

If the gateway rejects consecutive `user` messages, that is a bug against this
spec (do not silently merge). Live series/deixis stay consecutive `user`
messages. Few-shot series/deixis are consecutive lines in the system block.

The Chat-facing seam is the update handler. Prompt layout (live-only message
array, `[:инструкция]` suffix, fenced `[уn]` system block) is tested at
`conversationMessages` and `CONVERSATION_SYSTEM_PROMPT`.
