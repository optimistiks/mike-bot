# Where do v2 Marks live?

Type: grilling
Status: resolved

## Question

Vercel has no DynamoDB. Where do we persist v2 Marks so the Mini App can query honest Seasonal breakdowns (and later join v1 history)? Recommendation: Postgres (Neon or Vercel Postgres) with one row per Mark, timestamped, so Seasons are queries. Reject: stuffing counts into Grammy session JSON as the source of truth.

## Answer

Postgres on Neon. Three tables:

- **`events`** — v2 scoring facts: `type` (`karma` | `humor`), `value` (`+1` / `-1` for karma; `+1` for humor), `chat_id`, `actor_id`, `subject_id`, `message_id`, `created_at`. Generic names, decoupled from Telegram shape. See ADR-0004.
- **`legacy_marks`** — v1 DynamoDB import as-is (`lolType`, `fromUser`, `toUser`, …). Mapped to leaderboard math on read, not on import.
- **`chat_members`** — (`chat_id`, `user_id`) → latest display name.

Undo-on-remove deletes the matching event row.
