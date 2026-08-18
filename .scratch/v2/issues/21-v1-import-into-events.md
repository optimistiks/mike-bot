# How does v1 DynamoDB import into events?

Type: grilling
Status: open
Blocked by: 17

## Question

[Legacy read mapping](17-legacy-read-mapping.md) decided: one-shot Scan, convert each v1 row to an `events` row (`plus`→`karma.plus`, etc.). What still needs pinning down?

- Idempotency — re-run safe? (e.g. store v1 `id` on the event row, or deterministic import batch)
- `chat_members` seeding — still from import, but from converted events or a side pass over DynamoDB users?
- Drop `legacy_marks` from schema — confirm no other consumer needs raw v1 shape
