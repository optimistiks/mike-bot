import type { Context } from "grammy";

import { Bot } from "grammy";

import type { PendingTurn } from "./chat/pending.js";
import type { BotDatabase } from "./db/runtime.js";
import type { HandlerResult } from "./outcomes.js";

import { persistChatAssistantTurn } from "./chat/apply.js";
import { flushChatTelemetry, reportUnhandledFailure } from "./chat/observability.js";
import { finishChatWork, wakeReply } from "./chat/pending.js";
import { persistUpdate } from "./handle-update.js";
import { logError } from "./log.js";
import { persistPostedStandings } from "./standings/apply.js";
import { telegramBotUserId, telegramDateToPostedAt } from "./telegram/identity.js";

type BotInfo = NonNullable<NonNullable<ConstructorParameters<typeof Bot>[1]>["botInfo"]>;

interface BotDependencies {
  botInfo?: BotInfo;
  db: BotDatabase;
  onResult?: (result: HandlerResult) => void;
  schedule: (task: () => Promise<void>) => void;
  token: string;
}

type TelegramMessage = NonNullable<Context["message"] | Context["channelPost"]>;

async function tryDeleteMessage(
  ctx: Context,
  message: TelegramMessage,
  label: string,
): Promise<void> {
  try {
    await ctx.api.deleteMessage(message.chat.id, message.message_id);
  } catch (error) {
    logError(label, error);
  }
}

async function applyScoringOutcome(
  ctx: Context,
  message: TelegramMessage,
  result: HandlerResult,
): Promise<void> {
  if (result.type !== "scoring" || result.kind !== "accepted") {
    return;
  }
  const marked = message.reply_to_message;
  if (marked === undefined) {
    return;
  }
  await tryDeleteMessage(ctx, message, "failed to delete Scoring reply");
  await ctx.reply(result.text, {
    reply_parameters: { message_id: marked.message_id },
  });
}

async function applyStandingsOutcome(
  ctx: Context,
  db: BotDatabase,
  message: TelegramMessage,
  result: HandlerResult,
): Promise<void> {
  if (result.type !== "standings" || result.kind !== "posted") {
    return;
  }
  await tryDeleteMessage(ctx, message, "failed to delete Stats command");
  const sent = await ctx.replyWithRichMessage({
    html: result.text,
    skip_entity_detection: true,
  });
  await persistPostedStandings(db, message, sent);
}

async function applyChatOutcome(
  ctx: Context,
  db: BotDatabase,
  message: TelegramMessage,
  pending: PendingTurn,
  result: HandlerResult,
): Promise<void> {
  if (result.type !== "chat" || result.kind !== "reply") {
    return;
  }
  const sent = await ctx.reply(result.text, {
    ...(result.entities === undefined ? {} : { entities: result.entities }),
    ...(result.linkPreviewDisabled === true ? { link_preview_options: { is_disabled: true } } : {}),
    reply_parameters: { message_id: message.message_id },
  });
  await persistChatAssistantTurn(db, {
    chatId: pending.chatId,
    messageId: sent.message_id,
    postedAt: telegramDateToPostedAt(sent.date),
    reply: wakeReply(pending),
    text: result.text,
  });
}

async function applyImmediateOutcome(
  ctx: Context,
  db: BotDatabase,
  message: TelegramMessage,
  result: HandlerResult,
): Promise<void> {
  switch (result.type) {
    case "scoring": {
      await applyScoringOutcome(ctx, message, result);
      break;
    }
    case "standings": {
      await applyStandingsOutcome(ctx, db, message, result);
      break;
    }
    case "chat":
    case "noop": {
      break;
    }
    default: {
      break;
    }
  }
}

async function tryApplyImmediate(
  ctx: Context,
  db: BotDatabase,
  result: HandlerResult,
): Promise<void> {
  const message = ctx.message ?? ctx.channelPost;
  if (message === undefined) {
    return;
  }
  try {
    await applyImmediateOutcome(ctx, db, message, result);
  } catch (error) {
    logError("failed to answer in the Chat", error);
    reportUnhandledFailure(error);
  }
}

async function completeScheduled(
  ctx: Context,
  db: BotDatabase,
  pending: PendingTurn,
  onResult: ((result: HandlerResult) => void) | undefined,
): Promise<void> {
  try {
    const result = await finishChatWork(db, pending);
    onResult?.(result);
    const message = ctx.message ?? ctx.channelPost;
    if (message === undefined) {
      return;
    }
    await applyChatOutcome(ctx, db, message, pending, result);
  } catch (error) {
    logError("failed to complete Chat work", error);
    reportUnhandledFailure(error);
  } finally {
    await flushChatTelemetry();
  }
}

function createBot({ botInfo, db, onResult, schedule, token }: BotDependencies): Bot {
  const bot = botInfo === undefined ? new Bot(token) : new Bot(token, { botInfo });
  const botUserId = telegramBotUserId(token);

  bot.use(async (ctx) => {
    const work = await persistUpdate(ctx.update, { botUserId, db });
    if (work.type === "pending-turn") {
      schedule(() => completeScheduled(ctx, db, work, onResult));
      return;
    }
    onResult?.(work);
    await tryApplyImmediate(ctx, db, work);
  });

  // eslint-disable-next-line promise/prefer-await-to-callbacks, promise/prefer-await-to-then -- grammy bot.catch is a callback API
  bot.catch((error) => {
    logError("failed to handle update", {
      chat_id: error.ctx.chat?.id,
      error: error.error,
      update_id: error.ctx.update.update_id,
    });
    throw error.error;
  });

  return bot;
}

export { createBot, type BotDependencies };
