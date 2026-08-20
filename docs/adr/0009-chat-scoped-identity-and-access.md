# Scope identity, scoring, and access by Chat

Mike-bot serves multiple Telegram Chats, so Marks, Display identities, message-author resolution, Registrations, and Leaderboards are all Chat-scoped. Protected requests authenticate the Telegram-signed Member and require that Member's Registration in the requested Chat; identity alone never grants cross-Chat visibility. This adds Chat keys and authorization checks throughout the model but prevents unrelated groups from mixing or exposing data.
