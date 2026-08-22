/**
 * The prototype's four Chats.
 *
 * Hand-written rather than generated: faker's ru locale produces corporate
 * company names, not the names friends give a group chat. The fourth is
 * deliberately punishing — the header has to survive it without truncating.
 */
export interface PrototypeChat {
  id: number;
  name: string;
  initials: string;
}

export const PROTOTYPE_CHATS: PrototypeChat[] = [
  {
    id: -1001000000001,
    name: "Клуб пятничных созвонов",
    initials: "ПТ",
  },
  {
    id: -1001000000002,
    name: "Продуктовая кухня",
    initials: "ПК",
  },
  {
    id: -1001000000003,
    name: "Ночная смена",
    initials: "НС",
  },
  {
    id: -1001000000004,
    name: "Соседи по интернету и по лестничной клетке тоже",
    initials: "СИ",
  },
];

export function findPrototypeChat(chatId: number): PrototypeChat | undefined {
  return PROTOTYPE_CHATS.find((chat) => chat.id === chatId);
}

/**
 * The shared-element identity a Chat carries from the Chat list into the
 * Leaderboard header. Both ends have to agree on the string, so it is derived
 * in one place rather than templated twice.
 */
export function chatMorphName(chatId: number): string {
  // A `view-transition-name` is a CSS ident, and Chat ids are negative.
  return `chat-${String(chatId).replace("-", "n")}`;
}
