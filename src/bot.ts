import { Telegraf } from "telegraf";
import { Lol, mapper, saveLol, User } from "./saveLol";
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

enum ENTITY_TYPE {
  mention = "mention",
}

bot.command("lol", async (ctx, next) => {
  try {
    const mention = ctx.message?.entities?.find(
      (entity) => entity.type === ENTITY_TYPE.mention
    );

    if (!mention || !ctx.chat || !ctx.from || !ctx.message) {
      return next();
    }

    const username = ctx.message?.text?.slice(
      mention.offset,
      mention.offset + mention.length
    );

    const admins = await bot.telegram.getChatAdministrators(ctx.chat?.id);

    const admin = admins.find(
      (admin) => username === `@${admin.user.username}`
    );

    if (!admin) {
      console.error("admin not found");
      return next();
    }

    if (admin.user.id === ctx.from.id) {
      await ctx.reply("сам над своей шуткой посмеялся?", {
        reply_to_message_id: ctx.message.message_id,
      });
      return next();
    }

    const fromUser = new User(ctx.from.id, ctx.from.username);
    const toUser = new User(admin.user.id, admin.user.username);
    const lol = Lol.create(fromUser, toUser);
    await saveLol(lol);

    await ctx.deleteMessage(ctx.message.message_id);
    await ctx.reply(
      `${toUser.username || "???"} получает лол от ${
        fromUser.username || "???"
      }`
    );

    return next();
  } catch (err) {
    console.error("command failed", err);
    return next();
  }
});

bot.command("stats", async (ctx, next) => {
  const results: {
    [id: number]: { total: number; username: string };
  } = {};

  const iterator = mapper.scan(Lol, {});

  for await (const lol of iterator) {
    results[lol.toUser.id] = results[lol.toUser.id] || { total: 0 };
    results[lol.toUser.id].total += 1;
    results[lol.toUser.id].username = lol.toUser.username || "unknown";
  }

  const values = Object.values(results);

  if (values.length === 0) {
    return next();
  }

  values.sort((a, b) => b.total - a.total);

  let resultMessage = "";

  values.forEach((result) => {
    resultMessage += `${result.username}: ${result.total}\n`;
  });

  await ctx.reply(resultMessage);

  return next();
});

export { bot };
