import { Bot, type Context, webhookCallback } from "grammy";

import { gatewayConversationModel } from "./conversation/model";
import type { BotDatabase } from "./db/runtime";
import { handleUpdate } from "./handle-update";
import type { HandlerResult } from "./outcomes";
import { webhookHandlerOptions } from "./webhook";

export interface BotDependencies {
  db: BotDatabase;
  token: string;
  secretToken: string;
}

async function applyOutcome(ctx: Context, result: HandlerResult): Promise<void> {
  const message = ctx.message ?? ctx.channelPost;
  if (message === undefined) {
    return;
  }

  switch (result.type) {
    case "scoring": {
      if (result.kind !== "accepted") {
        return;
      }
      const marked = message.reply_to_message;
      if (marked === undefined) {
        return;
      }
      try {
        await ctx.api.deleteMessage(message.chat.id, message.message_id);
      } catch (error) {
        console.error("failed to delete Scoring reply", error);
      }
      await ctx.reply(result.text, {
        reply_parameters: { message_id: marked.message_id },
      });
      return;
    }
    case "standings": {
      if (result.kind !== "posted") {
        return;
      }
      try {
        await ctx.api.deleteMessage(message.chat.id, message.message_id);
      } catch (error) {
        console.error("failed to delete Stats command", error);
      }
      await ctx.reply(result.text, { parse_mode: "Markdown" });
      return;
    }
    case "conversation": {
      if (result.kind !== "reply") {
        return;
      }
      await ctx.reply(result.text, {
        reply_parameters: { message_id: message.message_id },
      });
      return;
    }
    case "noop":
      return;
  }
}

export function createBot({ db, token, secretToken }: BotDependencies): {
  bot: Bot;
  handleWebhook: (request: Request) => Promise<Response>;
} {
  const bot = new Bot(token);

  bot.use(async (ctx) => {
    const result = await handleUpdate(ctx.update, {
      db,
      model: gatewayConversationModel,
    });
    try {
      await applyOutcome(ctx, result);
    } catch (error) {
      console.error("failed to answer in the Chat", error);
    }
  });

  bot.catch((error) => {
    console.error("failed to handle update", {
      update_id: error.ctx.update.update_id,
      chat_id: error.ctx.chat?.id,
      error: error.error,
    });
    throw error.error;
  });

  const webhook = webhookCallback(bot, "std/http", webhookHandlerOptions(secretToken));

  return {
    bot,
    handleWebhook: async (request: Request) => webhook(request),
  };
}
