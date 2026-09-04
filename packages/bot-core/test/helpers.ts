import type { MessageEntity, Update, User } from "grammy/types";

const DEFAULT_DATE = 1_700_000_000;
const STATS_MESSAGE_ID_BASE = 9000;
const STATS_COMMAND_LENGTH = 6;

const CHAT_ID = -1001;

const ALICE: User = {
  first_name: "Alice",
  id: 101,
  is_bot: false,
  username: "alice",
};

const BOB: User = {
  first_name: "Bob",
  id: 102,
  is_bot: false,
  username: "bob",
};

const CAROL: User = {
  first_name: "Carol",
  id: 103,
  is_bot: false,
  username: "carol",
};

const BOT_USER: User = {
  first_name: "Bot",
  id: 900,
  is_bot: true,
  username: "some_bot",
};

interface TextUpdateOptions {
  updateId: number;
  messageId: number;
  from: User;
  text: string;
  replyTo?: { messageId: number; from: User };
  entities?: MessageEntity[];
  chatId?: number;
  date?: number;
}

interface ChatRef {
  id: number;
  title: string;
  type: "supergroup";
}

function applyOptionalMessageFields(
  message: NonNullable<Update["message"]>,
  options: TextUpdateOptions,
  chat: ChatRef,
  date: number,
): NonNullable<Update["message"]> {
  if (options.entities !== undefined) {
    message.entities = options.entities;
  }
  if (options.replyTo !== undefined) {
    message.reply_to_message = {
      chat,
      date,
      from: options.replyTo.from,
      message_id: options.replyTo.messageId,
      reply_to_message: undefined,
      text: "target",
    };
  }
  return message;
}

function buildMessage(
  options: TextUpdateOptions,
  chat: ChatRef,
  date: number,
): NonNullable<Update["message"]> {
  return applyOptionalMessageFields(
    {
      chat,
      date,
      from: options.from,
      message_id: options.messageId,
      text: options.text,
    },
    options,
    chat,
    date,
  );
}

function textUpdate(options: TextUpdateOptions): Update {
  const chatId = options.chatId ?? CHAT_ID;
  const date = options.date ?? DEFAULT_DATE;
  const chat: ChatRef = { id: chatId, title: "Chat", type: "supergroup" };
  return { message: buildMessage(options, chat, date), update_id: options.updateId };
}

function statsUpdate(updateId: number, from: User, chatId = CHAT_ID): Update {
  return textUpdate({
    chatId,
    entities: [{ length: STATS_COMMAND_LENGTH, offset: 0, type: "bot_command" }],
    from,
    messageId: STATS_MESSAGE_ID_BASE + updateId,
    text: "/stats",
    updateId,
  });
}

export { ALICE, BOB, BOT_USER, CAROL, CHAT_ID, statsUpdate, textUpdate };
