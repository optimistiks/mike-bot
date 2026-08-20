# Where does scoring logic live?

> Historical record: this resolved ticket is not canonical current-state documentation. Its question, answer, and acceptance criteria may now be false; use the Wayfinder map and specification for current behavior.

Type: grilling
Status: resolved

## Question

Event types carry no numeric value — application code maps them to leaderboard buckets (karma received, humor received, karma plus given, …). Where does this mapping live, and how is it shared between the bot (writes events) and the Mini App API (reads leaderboards)? One module, duplicated, or generated?

## Answer

**Single `lib/scoring/` module** in the Next.js app — imported by the webhook handler and the leaderboard API. No duplication, no code generation.

**Bot writes types only.** The Grammy handler maps reactions → event type strings and appends rows. It does not import bucket aggregation or leaderboard logic (type constants only).

**`lib/scoring/` owns read-side scoring:**
- Event type constants (`karma.plus`, …)
- `eventTypeToContributions(type)` — bucket matrix from [Legacy read mapping](17-legacy-read-mapping.md)
- `aggregateLeaderboard(events, season)` — five sections; net karma for «Уважаемые люди»
- Season bucketing in `Europe/Moscow`

**Telegram adapter stays separate.** Reaction emoji → event type mapping (including add vs undo from old/new diff) lives in `lib/bot/`. Scoring module knows event type strings only, not Telegram shapes.

**Thin API route.** `/api/leaderboard` queries `events` for `chat_id` + season, runs `aggregateLeaderboard`, joins `chat_members` for display names, returns five ranked lists with crown/chicken metadata for the UI.
