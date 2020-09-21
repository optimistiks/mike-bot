import { equals } from "@aws/dynamodb-expressions";
import { Telegraf } from "telegraf";
import { TelegrafContext } from "telegraf/typings/context";
import { ChatMember } from "telegraf/typings/telegram-types";
import { Lol, LolType, mapper, saveLol, User } from "./saveLol";
import { textToSpeech } from "./textToSpeech";

enum ENTITY_TYPE {
  mention = "mention",
}

enum TRIGGER {
  lol = "лол",
  plus = "+",
  minus = "-",
}

enum EMOJI {
  plus = "\u2795",
  minus = "\u2796",
  crown = "\uD83D\uDC51",
  chicken = "\uD83D\uDC14",
}

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

bot.hears(/[+|-]/, async (ctx, next) => {
  try {
    const text = getTextWithoutMentions(ctx);

    if (text !== TRIGGER.plus && text !== TRIGGER.minus) {
      return next();
    }

    const targets = await getTargets(ctx);

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
      const lol = Lol.create(
        ctx.chat.id,
        fromUser,
        toUser,
        text === TRIGGER.plus ? LolType.plus : LolType.minus
      );
      lols.push(lol);
    });

    await saveLol(lols);

    const receivers = lols
      .map((lol) => lol.toUser.username || "???")
      .join(", ");
    const word = lols.length === 1 ? "получает" : "получают";

    await ctx.deleteMessage(ctx.message?.message_id);
    await ctx.reply(
      `${receivers} ${word} ${
        text === TRIGGER.plus ? EMOJI.plus : EMOJI.minus
      } от ${ctx.from?.username || "???"}`
    );

    return next();

    return next();
  } catch (err) {
    console.error(err);
    return next();
  }
  return next();
});

bot.hears(new RegExp(/лол/, "i"), async (ctx, next) => {
  try {
    const text = getTextWithoutMentions(ctx);

    if (text !== TRIGGER.lol) {
      return next();
    }

    const targets = await getTargets(ctx);

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
      const lol = Lol.create(ctx.chat.id, fromUser, toUser, LolType.lol);
      lols.push(lol);
    });

    await saveLol(lols);

    const receivers = lols
      .map((lol) => lol.toUser.username || "???")
      .join(", ");
    const word = lols.length === 1 ? "получает" : "получают";

    await ctx.deleteMessage(ctx.message?.message_id);
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
    [id: number]: { lols: number; score: number; username: string };
  } = {};

  const iterator = mapper.scan(Lol, {
    filter: { subject: "chatId", ...equals(ctx.chat.id) },
  });

  for await (const lol of iterator) {
    const result = results[lol.toUser.id] || {
      lols: 0,
      score: 0,
      username: lol.toUser.username || "???",
    };

    switch (lol.lolType) {
      case LolType.lol:
        result.lols += 1;
        break;
      case LolType.plus:
        result.score += 1;
        break;
      case LolType.minus:
        result.score -= 1;
        break;
      default:
        break;
    }

    results[lol.toUser.id] = result;
  }

  const values = Object.values(results);

  if (values.length === 0) {
    return next();
  }

  let resultMessage = "";

  resultMessage += "*Уважаемые люди:*\n";
  values.sort((a, b) => b.score - a.score);
  values.forEach((result, index) => {
    const emoji =
      index === 0
        ? EMOJI.crown
        : index === values.length - 1
        ? EMOJI.chicken
        : "";
    resultMessage += `${result.username}: ${result.score} ${emoji}\n`;
  });
  resultMessage += "\n";

  resultMessage += "*Юмористы:*\n";
  values.sort((a, b) => b.lols - a.lols);
  values.forEach((result, index) => {
    const emoji =
      index === 0
        ? EMOJI.crown
        : index === values.length - 1
        ? EMOJI.chicken
        : "";
    resultMessage += `${result.username}: ${result.lols} ${emoji}\n`;
  });

  await ctx.deleteMessage(ctx.message?.message_id);
  await ctx.reply(resultMessage, { parse_mode: "Markdown" });

  return next();
});

export { bot };

async function getTargets(ctx: TelegrafContext): Promise<ChatMember[]> {
  if (!ctx.chat) {
    return [];
  }

  const mentions = ctx.message?.entities?.filter(
    (entity) => entity.type === ENTITY_TYPE.mention
  );

  if (!mentions) {
    return [];
  }

  const usernames: string[] = [];

  mentions.forEach((mention) => {
    const username = ctx.message?.text?.slice(
      mention.offset,
      mention.offset + mention.length
    );

    if (!username) {
      return;
    }

    usernames.push(username);
  });

  const admins = await bot.telegram.getChatAdministrators(ctx.chat?.id);

  let targets = admins.filter((admin) =>
    usernames.find((username) => username === `@${admin.user.username}`)
  );

  if (!process.env.AWS_SAM_LOCAL) {
    targets = targets.filter(
      (target) => target.user.id !== ctx.from?.id && !target.user.is_bot
    );
  }

  return targets;
}

function getTextWithoutMentions(ctx: TelegrafContext): string {
  const mentions = ctx.message?.entities?.filter(
    (entity) => entity.type === ENTITY_TYPE.mention
  );

  if (!mentions) {
    return ctx.message?.text || "";
  }

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
  });

  return text.trim().toLowerCase();
}
