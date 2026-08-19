/** Latest display name for chat_members (ticket #15). */
export function memberDisplayName(user: {
  username?: string;
  first_name: string;
}): string {
  return user.username ? `@${user.username}` : user.first_name;
}
