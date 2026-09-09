import type { Message } from "grammy/types";

const COMMAND_PATTERN = /^\/(?<name>[A-Za-z0-9_]+)/u;
const WAKE_TOKEN = "бот";
const STOP_TEXT = "довольно";

function hasBotCommand(message: Message): boolean {
  const entities = message.entities ?? [];
  return entities.some((entity) => entity.type === "bot_command");
}

function botCommandName(message: Message): string | null {
  if (!hasBotCommand(message) || message.text === undefined) {
    return null;
  }
  const match = COMMAND_PATTERN.exec(message.text);
  const name = match?.groups?.name;
  if (name === undefined) {
    return null;
  }
  return name.toLowerCase();
}

function isWakeMessage(text: string): boolean {
  const [token] = text.trim().split(/\s+/u);
  return token === WAKE_TOKEN;
}

function isStopMessage(text: string): boolean {
  return text.trim() === STOP_TEXT;
}

export { botCommandName, isStopMessage, isWakeMessage };
