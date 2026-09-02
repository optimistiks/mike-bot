import type { MessageEntity, Update, User } from "grammy/types";

const DEFAULT_DATE = 1_700_000_000;

export const CHAT_ID = -1001;

export const ALICE: User = {
  id: 101,
  is_bot: false,
  first_name: "Alice",
  username: "alice",
};

export const BOB: User = {
  id: 102,
  is_bot: false,
  first_name: "Bob",
  username: "bob",
};

export const CAROL: User = {
  id: 103,
  is_bot: false,
  first_name: "Carol",
  username: "carol",
};

export const BOT_USER: User = {
  id: 900,
  is_bot: true,
  first_name: "Bot",
  username: "some_bot",
};

export function textUpdate(options: {
  updateId: number;
  messageId: number;
  from: User;
  text: string;
  replyTo?: { messageId: number; from: User };
  entities?: MessageEntity[];
  chatId?: number;
  date?: number;
}): Update {
  const chatId = options.chatId ?? CHAT_ID;
  const date = options.date ?? DEFAULT_DATE;
  const chat = { id: chatId, type: "supergroup" as const, title: "Chat" };
  const message = {
    message_id: options.messageId,
    date,
    chat,
    from: options.from,
    text: options.text,
    ...(options.entities === undefined ? {} : { entities: options.entities }),
    ...(options.replyTo === undefined
      ? {}
      : {
          reply_to_message: {
            message_id: options.replyTo.messageId,
            date,
            chat,
            from: options.replyTo.from,
            text: "target",
            reply_to_message: undefined,
          },
        }),
  };

  return { update_id: options.updateId, message };
}

export function statsUpdate(updateId: number, from: User, chatId = CHAT_ID): Update {
  return textUpdate({
    updateId,
    messageId: 9000 + updateId,
    from,
    text: "/stats",
    entities: [{ type: "bot_command", offset: 0, length: 6 }],
    chatId,
  });
}
