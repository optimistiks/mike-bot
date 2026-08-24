import type { Chat } from "grammy/types";

/**
 * Whether Mike-bot scores in this kind of Telegram chat.
 *
 * Groups and supergroups both count: v1 scored in either, and a group that
 * never grew large enough for Telegram to upgrade it is still a Chat whose
 * members mark each other (ADR-0016). Private chats and channels are out —
 * neither can hold a Mark, since an Actor cannot mark their own Message and a
 * bot is never a Subject, and admitting a private chat would only write a
 * Registration the Mini App then lists as a titleless Chat.
 */
export function isScorableChatType(type: Chat["type"]): boolean {
  return type === "group" || type === "supergroup";
}
