import { Telegraf } from "telegraf";
import { textToSpeech } from "./textToSpeech";

if (!process.env.BOT_KEY || !process.env.BOT_USERNAME) {
  throw new Error("Missing BOT_KEY or BOT_USERNAME");
}

const bot = new Telegraf(process.env.BOT_KEY, {
  username: process.env.BOT_USERNAME,
});

bot.command("s", async (ctx, next) => {
  const text = ctx.update.message?.text?.replace(/\/\S*\s*/, "");

  if (!text) {
    return next();
  }

  try {
    const buffer = await textToSpeech(text);
    await ctx.replyWithAudio(
      { source: buffer as Buffer },
      {
        title: text,
        performer: ctx.from?.username,
      }
    );
    await ctx.deleteMessage(ctx.message?.message_id);
  } catch (err) {
    console.error(err);
  }

  return next();
});

export { bot };
