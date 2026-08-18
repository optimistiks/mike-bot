# Score with Telegram reactions, undo by removing

v1 Marks were reply texts (`+`, `-`, `лол`) that the bot deleted and confirmed in-chat. v2 Marks are three Scoring reactions. The same bans apply (no self, no bots; Humor is independent; Karma plus and Karma minus are mutually exclusive, switching allowed). Removing the reaction undoes the score by appending a compensating Event (inverse `value`) — nothing is deleted from the log. The group chat stays silent — counts live in the Mini App.

Dialogflow and Amazon Polly are dropped with v1.
