import type { User } from "grammy/types";

import type { ReplyMark } from "./types.js";

import { parentQuote } from "./quote.js";

const UNKNOWN_LABEL = "???";

function colonless(name: string): string {
  return name.replaceAll(":", "");
}

function nonemptyOrUnknown(value: string): string {
  if (value === "") {
    return UNKNOWN_LABEL;
  }
  return value;
}

function trimmed(value: string | undefined): string {
  return value?.trim() ?? "";
}

function fallbackHandle(firstName: string | undefined): string {
  return nonemptyOrUnknown(colonless(trimmed(firstName)));
}

function speakerHandle(username: string | undefined, firstName: string | undefined): string {
  const fromUsername = trimmed(username);
  if (fromUsername === "") {
    return fallbackHandle(firstName);
  }
  return fromUsername;
}

function speakerLabel(user: User): string {
  return speakerHandle(user.username, user.first_name);
}

function replyMark(
  targetLabel: string,
  rawQuote: string,
  targetMessageId: number | null,
  targetPostedAt: Date | null,
): ReplyMark {
  return { quote: parentQuote(rawQuote), targetLabel, targetMessageId, targetPostedAt };
}

export { replyMark, speakerHandle, speakerLabel };
