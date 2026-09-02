import type { User } from "grammy/types";

export function telegramDateToPostedAt(unixSeconds: number): Date {
  return new Date(unixSeconds * 1000);
}

export function telegramSecondTruncation(epochMs: number): Date {
  return new Date(Math.floor(epochMs / 1000) * 1000);
}

export function isBotUser(user: User | undefined): boolean {
  return user?.is_bot === true;
}
