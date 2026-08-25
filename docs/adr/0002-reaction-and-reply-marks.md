# Accept both Scoring reactions and v1 reply syntax

> Partly superseded by ADR-0015: Karma plus and Karma minus can no longer both
> be active on one Message, and reaction Marks are reversible only inside the
> Undo window. Accepting both inputs still holds.
>
> The three emoji named below are superseded by ADR-0019: they are only the
> defaults now, and each Chat's administrators may bind their own reactions,
> custom emoji included.

Marks are expressed two ways: by Telegram reactions (👍 👎 🤣), which are undoable and leave the Chat silent, and by the exact `+`, `-`, and `лол` replies the group has typed since v1. Reactions were the reason to build v2, but dropping replies would have broken the habit the bot exists to serve, so both inputs produce the same Events.

They differ where their medium differs. A reaction can be removed, so reaction Marks are reversible. A reply cannot be un-sent into an un-mark, so reply Marks are permanent; unlike v1 the bot neither deletes the reply nor answers with a message, it acknowledges with a 👍 reaction (superseded by ADR-0014, which restores v1's delete-and-answer). Karma plus and Karma minus may both be active on one Message and cancel in net Karma; Humor is independent of both. Counts are never announced in the Chat — they live in the Mini App.
