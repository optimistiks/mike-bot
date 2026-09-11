import type { Message, MessageEntity } from "grammy/types";

const COMMAND_PATTERN = /^\/(?<name>[A-Za-z0-9_]+)(?:@[A-Za-z0-9_]+)?/u;
const WAKE_TOKEN = "бот";

interface BotCommand {
  firstArg: string | undefined;
  name: string;
}

function hasBotCommand(message: Message): boolean {
  const entities = message.entities ?? [];
  return entities.some((entity) => entity.type === "bot_command");
}

function firstArg(text: string, commandLength: number): string | undefined {
  const rest = text.slice(commandLength).trim();
  if (rest === "") {
    return undefined;
  }
  const [token] = rest.split(/\s+/u);
  if (token === undefined || token === "") {
    return undefined;
  }
  return token;
}

function botCommand(message: Message): BotCommand | null {
  if (!hasBotCommand(message) || message.text === undefined) {
    return null;
  }
  const match = COMMAND_PATTERN.exec(message.text);
  const name = match?.groups?.name;
  const matched = match?.[0];
  if (name === undefined || matched === undefined) {
    return null;
  }
  return {
    firstArg: firstArg(message.text, matched.length),
    name: name.toLowerCase(),
  };
}

function isWakeMessage(text: string): boolean {
  const [token] = text.trim().split(/\s+/u);
  if (token === undefined) {
    return false;
  }
  const keyword = token.replace(/\p{P}+$/u, "").toLowerCase();
  return keyword === WAKE_TOKEN;
}

function textLinkUrl(entity: MessageEntity): string | null {
  if (entity.type !== "text_link") {
    return null;
  }
  const url = entity.url.trim();
  if (url === "") {
    return null;
  }
  return url;
}

function appendUrlAfter(text: string, end: number, display: string, url: string): string {
  if (display.includes(url)) {
    return text;
  }
  return `${text.slice(0, end)} ${url}${text.slice(end)}`;
}

function appendVisibleLink(visible: string, original: string, entity: MessageEntity): string {
  const url = textLinkUrl(entity);
  if (url === null) {
    return visible;
  }
  const start = entity.offset;
  const end = start + entity.length;
  if (start < 0 || end > original.length) {
    return visible;
  }
  return appendUrlAfter(visible, end, original.slice(start, end), url);
}

function textWithVisibleUrls(text: string, entities: readonly MessageEntity[] | undefined): string {
  if (entities === undefined || entities.length === 0) {
    return text;
  }
  const links = entities.toSorted((left, right) => right.offset - left.offset);
  let visible = text;
  for (const entity of links) {
    visible = appendVisibleLink(visible, text, entity);
  }
  return visible;
}

function visibleMessageText(message: Message): string | undefined {
  if (message.text === undefined) {
    return undefined;
  }
  return textWithVisibleUrls(message.text, message.entities);
}

function visibleMessageBody(message: Message): string {
  if (message.text !== undefined) {
    return textWithVisibleUrls(message.text, message.entities);
  }
  if (message.caption !== undefined) {
    return textWithVisibleUrls(message.caption, message.caption_entities);
  }
  return "";
}

export {
  botCommand,
  isWakeMessage,
  textWithVisibleUrls,
  visibleMessageBody,
  visibleMessageText,
  type BotCommand,
};
