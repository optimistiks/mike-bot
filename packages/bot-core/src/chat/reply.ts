import type { Message, User } from "grammy/types";

import { telegramDateToPostedAt } from "#src/telegram/identity.js";
import { visibleMessageBody } from "#src/telegram/text.js";

import type { ReplyMark } from "./types.js";

import { speakerHandle, speakerLabel } from "./label.js";
import { parentQuote } from "./quote.js";
import { SELF_LABEL } from "./transcript.js";

function isSelfUser(from: User | undefined, botUserId: number | undefined): boolean {
  if (from === undefined || botUserId === undefined) {
    return false;
  }
  return from.id === botUserId;
}

function parentSpeakerLabel(from: User | undefined, botUserId: number | undefined): string {
  if (isSelfUser(from, botUserId)) {
    return SELF_LABEL;
  }
  if (from === undefined) {
    return speakerHandle("", "");
  }
  return speakerLabel(from);
}

function rawMessageBody(message: Message): string {
  if (message.text !== undefined) {
    return message.text;
  }
  if (message.caption !== undefined) {
    return message.caption;
  }
  return "";
}

function quotedParentBody(parent: Message, botUserId: number | undefined): string {
  if (isSelfUser(parent.from, botUserId)) {
    return rawMessageBody(parent);
  }
  return visibleMessageBody(parent);
}

function replyFromParent(parent: Message, botUserId: number | undefined): ReplyMark {
  return {
    quote: parentQuote(quotedParentBody(parent, botUserId)),
    targetLabel: parentSpeakerLabel(parent.from, botUserId),
    targetMessageId: parent.message_id,
    targetPostedAt: telegramDateToPostedAt(parent.date),
  };
}

function replyFromMessage(message: Message, botUserId: number | undefined): ReplyMark | null {
  const parent = message.reply_to_message;
  if (parent === undefined) {
    return null;
  }
  return replyFromParent(parent, botUserId);
}

function isReplyToBot(message: Message, botUserId: number | undefined): boolean {
  return isSelfUser(message.reply_to_message?.from, botUserId);
}

export { isReplyToBot, replyFromMessage };
