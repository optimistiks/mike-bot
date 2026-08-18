# What does a reaction add vs remove look like?

Type: research
Status: resolved

## Question

From the Telegram Bot API and Grammy docs: exact shape of `message_reaction` (old vs new lists), who is `user`, whether the message author is included, admin requirement, whether a user can hold multiple emoji at once, and how to detect add vs remove of our three Scoring reactions so a Mark can be applied or undone. Note anything that breaks "no self, no bots, Karma plus/minus mutually exclusive".

## Answer

`MessageReactionUpdated` has `old_reaction` and `new_reaction` for one user on one message. Diff added/removed sets to apply or undo Marks. No message author in the update — cache `message_id → author` at post time. Admin + `allowed_updates` required. Telegram allows multiple reactions per user; karma ± exclusivity is app-enforced. Use `bot.on('message_reaction')`, not `bot.reaction()` alone (add-only, no undo).

Full findings: `docs/research/04-reaction-add-remove.md`
