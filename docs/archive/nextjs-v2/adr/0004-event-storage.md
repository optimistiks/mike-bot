# Store additions and explicit reversals as typed Events

> Superseded by ADR-0015: `events` is now `marks`, one row per spent grant, with
> uniqueness enforced by its primary key instead of a Message-row lock.

Every Event uses one of three canonical types: `karma.plus`, `karma.minus`, or `humor.add`. An addition has no reversal pointer; removing a reversible Scoring reaction appends a same-type, non-reversible Event whose unique `reversesEventId` points to the exact addition and whose contribution is inverted. Scoring replies and imported additions set `reversible=false`, so reaction removal cannot undo them. A Message-row lock serializes live changes and application code permits only one Active Mark per Chat, Actor, Message, and type; after reversal the same Mark may be added again. This keeps unlimited, auditable history and lets all input mechanisms share one model, at the cost of enforcing Active Mark uniqueness transactionally rather than with a static database uniqueness constraint.
