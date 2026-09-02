# Serve supergroups only, and assume Chat ids are stable

> Partly superseded by ADR-0018: plain groups are served too, and the predicate
> is back as `isScorableChatType`. Everything about the upgrade — no migration,
> stranded history, repair by hand — still holds, and now describes a case that
> can actually occur.

Mike-bot serves Telegram supergroups. A plain group, a channel, and a private chat are all ignored: no Message is cached, no Display identity is written, no Mark is placed, and the Stats command does nothing. Every Chat Mike-bot has ever served is a supergroup, which is what Telegram produces for any group large or old enough to matter here, and the `-100…` ids throughout the deployment notes assume it.

A Chat's id is therefore assumed stable for the life of the Chat. Telegram breaks that assumption exactly once, when a plain group is upgraded to a supergroup and every stored row keyed on the old `chat_id` is stranded. Mike-bot used to handle that: a `migrate_to_chat_id` branch moved Marks, Message authors, Display identities, Registrations, and the Chat row to the new id, guarded against collisions, then deleted whatever the guards refused. That machinery is deleted. It served an event that happens at most once per Chat, has never happened to any Chat Mike-bot serves, and cannot happen at all now that plain groups are ignored — a group Mike-bot never wrote to has no history to carry.

The cost is a latent trap that is now documented rather than handled: if a plain group is ever brought into scope and later upgraded, its Marks stay under the dead id and its Leaderboards read zero. The fix in that case is to restore a migration, not to reintroduce the predicate.

Two consequences are deliberate. The predicate that treated `group` and `supergroup` as one kind of Chat is gone, replaced by an inline comparison against `supergroup` at each of its seven call sites. A one-line function wrapping an equality check is indirection without abstraction, and the repeated literal states the assumption at the point where it is relied on. And the private-chat branch of the Stats command is gone with it, so a private caller gets no Registration row against a positive chat id.

This also settles a question a future architecture review will otherwise raise. ADR-0009 makes Chat scoping universal, which invites a registry of Chat-scoped tables so that the upgrade migration cannot silently miss one when a table is added. There is no upgrade migration to keep honest, so there is no registry to build.
