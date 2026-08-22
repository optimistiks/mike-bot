export interface MiniAppChat {
  chatId: number;
  title: string;
  photoVersion: string | null;
}

export function chatMorphName(chatId: number): string {
  return `chat-${String(chatId).replace("-", "n")}`;
}
