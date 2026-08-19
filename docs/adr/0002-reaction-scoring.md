# Score with Telegram reactions, undo by removing

v1 Marks were reply texts (`+`, `-`, `лол`) that the bot deleted and confirmed in-chat. v2 Marks are three independent Scoring reactions. The same bans apply (no self, no bots). Karma plus and Karma minus may both be active on one message and cancel in net Karma; Humor is independent of both. Removing a reaction appends an undo event type (e.g. `karma.undo.plus`) — nothing is deleted from the log. The group chat stays silent — counts live in the Mini App.

Dialogflow and Amazon Polly are dropped with v1.
