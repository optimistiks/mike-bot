export function chatIdFromStartParam(value: unknown): number | null {
  if (typeof value !== "string") return null;

  const match = /^chat_(-?\d+)$/.exec(value);
  if (!match?.[1]) return null;

  const chatId = Number(match[1]);
  return Number.isSafeInteger(chatId) ? chatId : null;
}
