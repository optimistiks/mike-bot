export const STATS_BUTTON_TEXT = "Открыть таблицы лидеров";
export const STATS_MESSAGE_TEXT =
  "Готово! Откройте таблицы лидеров этой группы:";

export function miniAppLink(botUsername: string, chatId?: number): string {
  const base = `https://t.me/${botUsername}`;
  return chatId === undefined
    ? `${base}?startapp`
    : `${base}?startapp=chat_${String(chatId)}`;
}
