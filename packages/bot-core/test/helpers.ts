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

const LENA: User = {
  first_name: "Лена",
  id: 104,
  is_bot: false,
  last_name: "Иванова",
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
  replyTo?: { date?: number; from: User; messageId: number; text?: string | null };
  entities?: MessageEntity[];
  chatId?: number;
  date?: number;
}

interface ChatRef {
  id: number;
  title: string;
  type: "supergroup";
}

function replyToParentText(text: string | null | undefined): string | undefined {
  if (text === null) {
    return undefined;
  }
  if (text === undefined) {
    return "target";
  }
  return text;
}

function replyToMessage(
  options: NonNullable<TextUpdateOptions["replyTo"]>,
  chat: ChatRef,
  fallbackDate: number,
): NonNullable<Update["message"]>["reply_to_message"] {
  const date = options.date ?? fallbackDate;
  const parentText = replyToParentText(options.text);
  const parent = {
    chat,
    date,
    from: options.from,
    message_id: options.messageId,
    reply_to_message: undefined,
  };
  if (parentText === undefined) {
    return parent;
  }
  return { ...parent, text: parentText };
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
    message.reply_to_message = replyToMessage(options.replyTo, chat, date);
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

function commandEntityLength(text: string): number {
  const match = /^\/[A-Za-z0-9_]+(?:@[A-Za-z0-9_]+)?/u.exec(text);
  const matched = match?.[0];
  if (matched === undefined) {
    return STATS_COMMAND_LENGTH;
  }
  return matched.length;
}

function statsUpdate(
  updateId: number,
  from: User,
  options: { chatId?: number; date?: number; text?: string } = {},
): Update {
  const text = options.text ?? "/stats";
  return textUpdate({
    chatId: options.chatId ?? CHAT_ID,
    date: options.date,
    entities: [{ length: commandEntityLength(text), offset: 0, type: "bot_command" }],
    from,
    messageId: STATS_MESSAGE_ID_BASE + updateId,
    text,
    updateId,
  });
}

export { ALICE, BOB, BOT_USER, CAROL, CHAT_ID, LENA, statsUpdate, textUpdate };
