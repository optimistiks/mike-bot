export function isGroupChat(chatType: string): boolean {
  return chatType === "group" || chatType === "supergroup";
}
