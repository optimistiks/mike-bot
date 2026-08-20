# Scope identity, scoring, and access by Chat

Mike-bot serves multiple Telegram Chats rather than one fixed group. Marks, display identity, message-author resolution, registration, and leaderboards are all Chat-scoped; a Telegram user ID alone never grants visibility into another Chat.

This adds Chat keys and authorization checks throughout the model, but prevents unrelated groups from mixing data and lets one deployment serve more than one community safely.
