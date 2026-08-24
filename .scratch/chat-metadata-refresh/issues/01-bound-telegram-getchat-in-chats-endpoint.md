# 01: Bound the Telegram getChat call in /api/chats

Status: needs-triage

## Problem

`resolveChatMetadata` (`apps/web/lib/bot/chat-metadata.ts:139`) calls
`new Api(botToken).getChat(chatId)` with no timeout on every `/api/chats` request until a
successful call sets `metadataCheckedAt` — and `upsertChatFromTelegramUpdate` writes the title
without ever setting it. So once you register a chat, every chat-list request makes a live
Telegram call inside a `Promise.all`. It's fine when Telegram is fast (0.3s from a dev machine),
but it's the same shape of hazard as the Telegram Desktop launch hang: an unbounded await on
Telegram in a path the UI blocks on.

## Context

Found while diagnosing a different bug — the Mini App sitting on its loading skeleton forever on
Telegram Desktop. That one turned out to be `viewport.mount()` awaiting a `safe_area_changed`
event Desktop never sends, with no timeout anywhere in `@tma.js/sdk` on that path; fixed by not
awaiting the viewport mount during launch. This issue is the same failure mode still latent on the
server side: `ChatsRoute` renders `<ArcadeLoading />` while the `/api/chats` query is pending, so
a `/api/chats` request that never returns shows as a permanent skeleton with no error.

## Done when

- A slow or unreachable Telegram API cannot leave `/api/chats` pending indefinitely.
- A freshly registered Chat does not trigger a live `getChat` on every single chat-list request.
