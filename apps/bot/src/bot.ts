import type { Context } from "grammy";

import { Bot, webhookCallback } from "grammy";

import type { BotDatabase } from "./db/runtime.js";
import type { HandlerResult } from "./outcomes.js";

import { gatewayConversationModel } from "./conversation/model.js";
import { handleUpdate } from "./handle-update.js";
import { logError } from "./log.js";
import { webhookHandlerOptions } from "./webhook.js";

interface BotDependencies {
  db: BotDatabase;
  token: string;
  secretToken: string;
}

type TelegramMessage = NonNullable<Context["message"] | Context["channelPost"]>;
type OutcomeApplier = (
  ctx: Context,
  message: TelegramMessage,
  result: HandlerResult,
) => Promise<void>;

function isAcceptedScoring(
  result: HandlerResult,
): result is Extract<HandlerResult, { type: "scoring"; kind: "accepted" }> {
  return result.type === "scoring" && result.kind === "accepted";
}

function isPostedStandings(
  result: HandlerResult,
): result is Extract<HandlerResult, { type: "standings"; kind: "posted" }> {
  return result.type === "standings" && result.kind === "posted";
}

function isConversationReply(
  result: HandlerResult,
): result is Extract<HandlerResult, { type: "conversation"; kind: "reply" }> {
  return result.type === "conversation" && result.kind === "reply";
}

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
  if (!isAcceptedScoring(result)) {
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
  if (!isPostedStandings(result)) {
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
  if (!isConversationReply(result)) {
    return;
  }
  await ctx.reply(result.text, {
    reply_parameters: { message_id: message.message_id },
  });
}

async function skipOutcome(): Promise<void> {
  await Promise.resolve();
}

const outcomeAppliers: Record<HandlerResult["type"], OutcomeApplier> = {
  conversation: applyConversationOutcome,
  noop: skipOutcome,
  scoring: applyScoringOutcome,
  standings: applyStandingsOutcome,
};

async function applyOutcome(ctx: Context, result: HandlerResult): Promise<void> {
  const message = ctx.message ?? ctx.channelPost;
  if (message === undefined) {
    return;
  }
  await outcomeAppliers[result.type](ctx, message, result);
}

async function tryApplyOutcome(ctx: Context, result: HandlerResult): Promise<void> {
  try {
    await applyOutcome(ctx, result);
  } catch (error) {
    logError("failed to answer in the Chat", error);
  }
}

function createBot({ db, token, secretToken }: BotDependencies): {
  bot: Bot;
  handleWebhook: (request: Request) => Promise<Response>;
} {
  const bot = new Bot(token);

  bot.use(async (ctx) => {
    const result = await handleUpdate(ctx.update, {
      db,
      model: gatewayConversationModel,
    });
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

  const webhook = webhookCallback(bot, "std/http", webhookHandlerOptions(secretToken));

  return {
    bot,
    handleWebhook: (request: Request): Promise<Response> => webhook(request),
  };
}

export { createBot, type BotDependencies };
