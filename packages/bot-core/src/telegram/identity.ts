import type { User } from "grammy/types";

import { EMPTY_COUNT, FIRST_INDEX, MS_PER_SECOND, SINGLE_COUNT } from "#src/constants.js";

function telegramDateToPostedAt(unixSeconds: number): Date {
  return new Date(unixSeconds * MS_PER_SECOND);
}

function telegramSecondTruncation(epochMs: number): Date {
  return new Date(Math.floor(epochMs / MS_PER_SECOND) * MS_PER_SECOND);
}

function isBotUser(user: User | undefined): boolean {
  return user?.is_bot === true;
}

function parsedBotUserId(prefix: string): number | undefined {
  const id = Number(prefix);
  if (Number.isInteger(id) && id > EMPTY_COUNT) {
    return id;
  }
  return undefined;
}

function telegramBotUserId(token: string): number | undefined {
  const colonAt = token.indexOf(":");
  if (colonAt < SINGLE_COUNT) {
    return undefined;
  }
  return parsedBotUserId(token.slice(FIRST_INDEX, colonAt));
}

export { isBotUser, telegramBotUserId, telegramDateToPostedAt, telegramSecondTruncation };
