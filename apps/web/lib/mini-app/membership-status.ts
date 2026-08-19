/** Telegram ChatMember status values we treat as "still in chat". */
export type ActiveMemberStatus =
  "creator" | "administrator" | "member" | "restricted";

const ACTIVE_STATUSES = new Set<string>([
  "creator",
  "administrator",
  "member",
  "restricted",
]);

const BOT_PRESENT_STATUSES = new Set<string>([
  "creator",
  "administrator",
  "member",
  "restricted",
]);

export function isActiveChatMemberStatus(status: string): boolean {
  return ACTIVE_STATUSES.has(status);
}

export function isBotPresentStatus(status: string): boolean {
  return BOT_PRESENT_STATUSES.has(status);
}
