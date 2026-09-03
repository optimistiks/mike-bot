import type { User } from "grammy/types";

import { MS_PER_SECOND } from "#src/constants.js";

function telegramDateToPostedAt(unixSeconds: number): Date {
  return new Date(unixSeconds * MS_PER_SECOND);
}

function telegramSecondTruncation(epochMs: number): Date {
  return new Date(Math.floor(epochMs / MS_PER_SECOND) * MS_PER_SECOND);
}

function isBotUser(user: User | undefined): boolean {
  return user?.is_bot === true;
}

export { isBotUser, telegramDateToPostedAt, telegramSecondTruncation };
