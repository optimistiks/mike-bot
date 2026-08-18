# Where do v2 Marks live?

Type: grilling
Status: resolved

## Question

Vercel has no DynamoDB. Where do we persist v2 Marks so the Mini App can query honest Seasonal breakdowns (and later join v1 history)? Recommendation: Postgres (Neon or Vercel Postgres) with one row per Mark, timestamped, so Seasons are queries. Reject: stuffing counts into Grammy session JSON as the source of truth.

## Answer

Postgres on Neon (Vercel-friendly). One `marks` table for v2: one row per Mark (reactor, author, type, `chatId`, `createdAt`, message reference as needed). v1 history goes in a **separate** `legacy_marks` table — no `source` field on either table.
