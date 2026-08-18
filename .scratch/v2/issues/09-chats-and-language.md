# Which chats and which language?

Type: grilling
Status: resolved

## Question

v1 keyed Marks by `chatId` and could theoretically serve many chats. Is v2 one specific group (the boys' chat) or any group the bot is added to? What language is the Mini App (Russian like v1 `/stats`, English, or both)?

## Answer

Multi-chat: keep `chatId` as the scope key (bot can serve many groups). Mini App UI labels in **Russian** (Уважаемые люди, Юмористы, etc.); glossary stays English in `CONTEXT.md`.
