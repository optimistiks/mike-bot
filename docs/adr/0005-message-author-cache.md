# Cache only message authors for Subject resolution

Telegram reaction updates identify the Actor but not the message author, and the Bot API cannot fetch an arbitrary message, so the bot stores only the original author identity, bot status, and timestamp for each observed message. It deliberately stores no message content, limiting its privacy surface at the cost of ignoring Marks on messages it did not observe. The first observation wins because a message's original authorship and timestamp do not change.
