const ACTIVE_STATUSES = new Set<string>([
  "creator",
  "administrator",
  "member",
  "restricted",
]);

export function isActiveChatMemberStatus(status: string): boolean {
  return ACTIVE_STATUSES.has(status);
}

const ADMIN_STATUSES = new Set<string>(["creator", "administrator"]);

/**
 * Whether a status is administration rather than mere membership.
 *
 * Kept beside `isActiveChatMemberStatus` because the two are easy to confuse:
 * that one asks whether a Member may *view* a Chat's Leaderboards, this one
 * whether they may *change* what the Chat scores by (ADR-0019).
 */
export function isChatAdminStatus(status: string): boolean {
  return ADMIN_STATUSES.has(status);
}
