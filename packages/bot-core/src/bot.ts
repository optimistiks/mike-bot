import type { Context } from "grammy";

import { Bot } from "grammy";

import type { BotDatabase } from "./db/runtime.js";
import type { HandlerResult } from "./outcomes.js";

import { reportUnhandledFailure } from "./conversation/observability.js";
import { handleUpdate } from "./handle-update.js";
import { logError } from "./log.js";
import { telegramBotUserId } from "./telegram/identity.js";

interface BotDependencies {
  db: BotDatabase;
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

async function tryReactToStop(ctx: Context): Promise<void> {
  try {
    await ctx.react("👍", { is_big: false });
  } catch (error) {
    logError("failed to react to Stop message", error);
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
  message: TelegramMessage,
  result: HandlerResult,
): Promise<void> {
  if (result.type !== "standings" || result.kind !== "posted") {
    return;
  }
  await tryDeleteMessage(ctx, message, "failed to delete Stats command");
  await ctx.reply(result.text, { parse_mode: "Markdown" });
}

async function applyConversationOutcome(
  ctx: Context,
  message: TelegramMessage,
  result: HandlerResult,
): Promise<void> {
  if (result.type !== "conversation") {
    return;
  }
  if (result.kind === "closed") {
    await tryReactToStop(ctx);
    return;
  }
  if (result.kind !== "reply") {
    return;
  }
  await ctx.reply(result.text, {
    reply_parameters: { message_id: message.message_id },
  });
}

async function applyOutcome(ctx: Context, result: HandlerResult): Promise<void> {
  const message = ctx.message ?? ctx.channelPost;
  if (message === undefined) {
    return;
  }
  switch (result.type) {
    case "scoring":
      await applyScoringOutcome(ctx, message, result);
      return;
    case "standings":
      await applyStandingsOutcome(ctx, message, result);
      return;
    case "conversation":
      await applyConversationOutcome(ctx, message, result);
      return;
    default:
  }
}

async function tryApplyOutcome(ctx: Context, result: HandlerResult): Promise<void> {
  try {
    await applyOutcome(ctx, result);
  } catch (error) {
    logError("failed to answer in the Chat", error);
    reportUnhandledFailure(error);
  }
}

function createBot({ db, token }: BotDependencies): Bot {
  const bot = new Bot(token);
  const botUserId = telegramBotUserId(token);

  bot.use(async (ctx) => {
    const result = await handleUpdate(ctx.update, { botUserId, db });
    await tryApplyOutcome(ctx, result);
  });

  // eslint-disable-next-line promise/prefer-await-to-callbacks -- grammy bot.catch is a callback API
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
