import type { User } from "grammy/types";

const MS_PER_SECOND = 1000;

function telegramDateToPostedAt(unixSeconds: number): Date {
  return new Date(unixSeconds * MS_PER_SECOND);
}

function isBotUser(user: User | undefined): boolean {
  return user?.is_bot === true;
}

function parsedBotUserId(prefix: string): number | undefined {
  const id = Number(prefix);
  if (Number.isInteger(id) && id > 0) {
    return id;
  }
  return undefined;
}

function telegramBotUserId(token: string): number | undefined {
  const colonAt = token.indexOf(":");
  if (colonAt < 1) {
    return undefined;
  }
  return parsedBotUserId(token.slice(0, colonAt));
}

export { isBotUser, telegramBotUserId, telegramDateToPostedAt };
