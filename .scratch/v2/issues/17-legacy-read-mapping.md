# How does legacy_marks map to leaderboards?

Type: grilling
Status: resolved

## Question

`legacy_marks` uses v1 `lolType` (`plus`, `minus`, `lol`) with `fromUser` / `toUser`. v2 `events` use typed strings (`karma.plus`, `humor.add`, …). The Mini App shows five RU sections merging both sources. How exactly does each legacy row and each event type contribute to each section?

## Answer

**Single table at runtime.** One-shot DynamoDB import converts v1 rows into `events` rows — no separate `legacy_marks` table, no merge-on-read. The Mini App queries `events` only.

**v2 event type → leaderboard buckets** (application code at read time; undo types invert the add):

| Event type | Karma received (subject) | Humor received (subject) | Karma+ given (actor) | Karma− given (actor) | Humor given (actor) |
| --- | --- | --- | --- | --- | --- |
| `karma.plus` | +1 | — | +1 | — | — |
| `karma.undo.plus` | −1 | — | −1 | — | — |
| `karma.minus` | −1 | — | — | +1 | — |
| `karma.undo.minus` | +1 | — | — | −1 | — |
| `humor.add` | — | +1 | — | — | +1 |
| `humor.undo.add` | — | −1 | — | — | −1 |

**Karma received** («Уважаемые люди») is net karma for `subject_id` (plus and minus events combined).

**v1 import conversion** (one-time, at import — not read-time):

| v1 `lolType` | v2 `type` |
| --- | --- |
| `plus` | `karma.plus` |
| `minus` | `karma.minus` |
| `lol` | `humor.add` |

Map `fromUser.id` → `actor_id`, `toUser.id` → `subject_id`, `chatId` → `chat_id`, `toMessageId` → `message_id`, `createdAt` → `created_at`. v1 had no undos — every imported row is an add-type event.

**RU section labels** for the three “given” lists: keep v1 copy («Поставили +», «Поставили −», «Поставили лол»).

**Supersedes** the dual-table plan in tickets 07 and 08 and ADR-0004 — those need reconciling (see map fog).
