import type { Message } from "grammy/types";

export function botCommandName(message: Message): string | null {
  const entities = message.entities ?? [];
  const hasCommand = entities.some((entity) => entity.type === "bot_command");
  if (!hasCommand || message.text === undefined) {
    return null;
  }

  const match = /^\/([A-Za-z0-9_]+)/.exec(message.text);
  const name = match?.[1];
  if (name === undefined) {
    return null;
  }

  return name.toLowerCase();
}

export function isWakeMessage(text: string): boolean {
  const token = text.trim().split(/\s+/u)[0];
  return token === "бот";
}

export function isStopMessage(text: string): boolean {
  return text.trim() === "довольно";
}
