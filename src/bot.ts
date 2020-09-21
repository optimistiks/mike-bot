import { equals } from "@aws/dynamodb-expressions";
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

enum MSG {
  lol = "лол",
}

bot.hears(new RegExp(MSG.lol, "i"), async (ctx, next) => {
  try {
    const mentions = ctx.message?.entities?.filter(
      (entity) => entity.type === ENTITY_TYPE.mention
    );

    if (!mentions) {
      return next();
    }

    const usernames: string[] = [];

    let text = ctx.message?.text || "";

    mentions.forEach((mention) => {
      const username = ctx.message?.text?.slice(
        mention.offset,
        mention.offset + mention.length
      );

      if (!username) {
        return;
      }

      text = text.replace(username, "");

      usernames.push(username);
    });

    if (text.trim().toLowerCase() !== MSG.lol) {
      return next();
    }

    if (!ctx.chat) {
      return next();
    }

    const admins = await bot.telegram.getChatAdministrators(ctx.chat?.id);

    const targets = admins
      .filter((admin) =>
        usernames.find((username) => username === `@${admin.user.username}`)
      )
      .filter(
        (target) => target.user.id !== ctx.from?.id && !target.user.is_bot
      );

    if (targets.length === 0) {
      return next();
    }

    const lols: Lol[] = [];

    targets.forEach((target) => {
      if (!ctx.from || !ctx.chat) {
        return;
      }
      const fromUser = new User(ctx.from.id, ctx.from.username);
      const toUser = new User(target.user.id, target.user.username);
      const lol = Lol.create(ctx.chat.id, fromUser, toUser);
      lols.push(lol);
    });

    await saveLol(lols);

    const receivers = lols
      .map((lol) => lol.toUser.username || "???")
      .join(", ");
    const word = lols.length === 1 ? "получает" : "получают";

    await ctx.reply(
      `${receivers} ${word} лол от ${ctx.from?.username || "???"}`
    );

    return next();
  } catch (err) {
    console.error(err);
    return next();
  }
  return next();
});

bot.command("stats", async (ctx, next) => {
  if (!ctx.chat) {
    return next();
  }

  const results: {
    [id: number]: { total: number; username: string };
  } = {};

  const iterator = mapper.scan(Lol, {
    filter: { subject: "chatId", ...equals(ctx.chat.id) },
  });

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
