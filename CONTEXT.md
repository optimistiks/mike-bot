# Mike-bot

Telegram scoring bot. Members mark each other's messages, print Standings, and talk to the bot in a Conversation.

## Language

**Chat**:
A Telegram chat the bot is in.
_Avoid_: group, channel, room

**Conversation**:
One session of the bot talking in a Chat. It is minted closed, opened once by a Wake, and closed by the last Stop. It is never opened again.
_Avoid_: collector, session, thread, Sentry conversation (the Sentry id is the Conversation id)

**Turn**:
One utterance in a Conversation: member text, a bot reply, or a scoring / stats line recorded as context.
_Avoid_: message (that is scoring identity), log line

**Participant**:
A member who has Woken into this Conversation and has not yet Stopped.

**Wake**:
A message whose first token is `бот`. It opens the Chat's unopened Conversation, or joins the open one.

**Stop**:
The message `довольно` from a Participant. The last Participant's Stop closes the Conversation.
