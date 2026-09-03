import type { Message } from "grammy/types";

const COMMAND_PATTERN = /^\/(?<name>[A-Za-z0-9_]+)/u;
const WAKE_TOKEN = "бот";
const STOP_TEXT = "довольно";

function hasBotCommand(message: Message): boolean {
  const entities = message.entities ?? [];
  return entities.some((entity) => entity.type === "bot_command");
}

function namedOrNull(name: string | undefined): string | null {
  if (name === undefined) {
    return null;
  }
  return name.toLowerCase();
}

function commandNameFromGroups(groups: { name?: string } | undefined): string | null {
  if (groups === undefined) {
    return null;
  }
  return namedOrNull(groups.name);
}

function namedCommand(text: string): string | null {
  const match = COMMAND_PATTERN.exec(text);
  if (match === null) {
    return null;
  }
  return commandNameFromGroups(match.groups);
}

function botCommandName(message: Message): string | null {
  if (!hasBotCommand(message) || message.text === undefined) {
    return null;
  }
  return namedCommand(message.text);
}

function isWakeMessage(text: string): boolean {
  const [token] = text.trim().split(/\s+/u);
  return token === WAKE_TOKEN;
}

function isStopMessage(text: string): boolean {
  return text.trim() === STOP_TEXT;
}

export { botCommandName, isStopMessage, isWakeMessage };
