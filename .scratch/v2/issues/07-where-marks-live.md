# Where do v2 Marks live?

Type: grilling
Status: resolved

## Question

Vercel has no DynamoDB. Where do we persist v2 Marks so the Mini App can query honest Seasonal breakdowns (and later join v1 history)? Recommendation: Postgres (Neon or Vercel Postgres) with one row per Mark, timestamped, so Seasons are queries. Reject: stuffing counts into Grammy session JSON as the source of truth.

## Answer

Postgres on Neon (Vercel-friendly). Three tables: `marks` (v2 Marks), `legacy_marks` (v1 import as-is), `chat_members` (`chatId` + `userId` → latest display name). No `source` column on any table.
