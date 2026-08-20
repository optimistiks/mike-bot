/** Latest known display name for a Member in a Chat. */
export function memberDisplayName(user: {
  username?: string;
  first_name: string;
}): string {
  return user.username ? `@${user.username}` : user.first_name;
}
