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

    if (!mention || !ctx.chat || !ctx.from) {
      await ctx.reply(`not enough data`);
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
      await ctx.reply(`user ${username} not found`);
      return next();
    }

    const fromUser = new User(
      ctx.from.id,
      ctx.from.username,
      ctx.from.first_name
    );

    const toUser = new User(
      admin.user.id,
      admin.user.username,
      admin.user.first_name
    );

    const lol = Lol.create(fromUser, toUser);

    await saveLol(lol);

    await ctx.reply(`фиксирую данную информацию...`);

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

  const keys = (Object.keys(results) as unknown) as number[];

  if (keys.length === 0) {
    await ctx.reply(`пока ничего нет`);
    return next();
  }

  let resultMessage = "";

  keys.forEach((userId: number) => {
    const result = results[userId];
    resultMessage += `@${result.username}: ${result.total}\n`;
  });

  await ctx.reply(resultMessage);

  return next();
});

export { bot };
