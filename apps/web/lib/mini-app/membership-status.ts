const ACTIVE_STATUSES = new Set<string>([
  "creator",
  "administrator",
  "member",
  "restricted",
]);

export function isActiveChatMemberStatus(status: string): boolean {
  return ACTIVE_STATUSES.has(status);
}
