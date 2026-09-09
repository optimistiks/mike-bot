import type { Message } from "grammy/types";

const COMMAND_PATTERN = /^\/(?<name>[A-Za-z0-9_]+)(?:@[A-Za-z0-9_]+)?/u;
const WAKE_TOKEN = "бот";
const STOP_TEXT = "довольно";

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

function isStopMessage(text: string): boolean {
  return text.trim().toLowerCase() === STOP_TEXT;
}

export { botCommand, isStopMessage, isWakeMessage, type BotCommand };
