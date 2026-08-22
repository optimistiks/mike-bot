# 09: Normalize imported message metadata

Type: grilling
Status: resolved
Blocked by: 01

## Question

What exact writes should importing one v1 row produce so every Event uses `message_authors.message_date` for
Season attribution, regardless of provenance?

## Done when

- The first-import and rerun outcomes are explicit.
- One v1 row remains one v2 Event; no Events are grouped or collapsed.
- The downstream SQL boundary can treat every Event identically for Season attribution.

## Answer

For a previously unimported v1 row, the importer always inserts exactly one v2 `events` row. It also ensures
that the message has one `message_authors` row, inserting it only when `(chat_id, message_id)` is absent:

| `message_authors` column | v1 source |
| --- | --- |
| `chat_id` | `row.chatId` |
| `message_id` | `row.toMessageId` |
| `author_id` | `row.toUser.id` |
| `author_is_bot` | `false` |
| `message_date` | `Math.floor(row.createdAt / 1000)` |

Therefore one first-time row import has exactly one of two outcomes:

1. Existing message metadata: one new `events` row.
2. Missing message metadata: one new `events` row plus one new `message_authors` row.

The importer must ensure `message_authors` before attempting the idempotent Event insert. Rerunning an already
imported row then backfills missing message metadata even when `legacy_id` causes the Event insert to be
skipped. Once both records exist, another rerun inserts neither.

No v1 Event rows are grouped, merged, or collapsed. Several Event rows may reference the same
`message_authors` row because several Members may have reacted to the same message.

After this change, every stats query derives Season attribution from `message_authors.message_date`.
`legacy_id` remains only import provenance and Event idempotency, and the existing provenance-specific branch
in `queryLeaderboard` must be removed during implementation.
