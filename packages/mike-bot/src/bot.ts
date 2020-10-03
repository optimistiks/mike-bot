import { v4 as uuidv4 } from "uuid";
import { Telegraf } from "telegraf";
import { TelegrafContext } from "telegraf/typings/context";
import { Lol, lolStore, LolType, User } from "./lolModel";
import { textToSpeech } from "./textToSpeech";
import { dialogflowMiddleware } from "./middleware/dialogflowMiddleware";

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

bot.catch((err: Error, ctx: TelegrafContext) => {
  console.error(err, `bot error ${err.message}, ${ctx.updateType}`);
});

bot.command("s", async (ctx) => {
  const text = ctx.update.message?.text?.replace(/\/\S*\s*/, "");

  if (!text) {
    return;
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
});

bot.hears(/[+|-]/, async (ctx) => {
  try {
    const text = getCleanText(ctx);

    if (text !== TRIGGER.plus && text !== TRIGGER.minus) {
      return;
    }

    const lolExists = await isLolExists(ctx, [LolType.plus, LolType.minus]);

    if (lolExists) {
      return;
    }

    const lolType = text === TRIGGER.plus ? LolType.plus : LolType.minus;

    const lol = createLolFromCtx(ctx, lolType);

    if (!lol) {
      return;
    }

    await saveLols([lol]);

    await ctx.deleteMessage(ctx.message?.message_id);
    const emoji = text === TRIGGER.plus ? EMOJI.plus : EMOJI.minus;
    await ctx.reply(`${emoji} (${lol.fromUser.username || "???"})`, {
      reply_to_message_id: ctx.message?.reply_to_message?.message_id,
    });
  } catch (err) {
    console.error(err);
  }
});

bot.hears(new RegExp(/лол/, "i"), async (ctx) => {
  try {
    const text = getCleanText(ctx);

    if (text !== TRIGGER.lol) {
      return;
    }

    const lolExists = await isLolExists(ctx, [LolType.lol]);

    if (lolExists) {
      return;
    }

    const lol = createLolFromCtx(ctx, LolType.lol);

    if (!lol) {
      return;
    }

    await saveLols([lol]);

    await ctx.deleteMessage(ctx.message?.message_id);
    await ctx.reply(`лол (${lol.fromUser.username || "???"})`, {
      reply_to_message_id: ctx.message?.reply_to_message?.message_id,
    });
  } catch (err) {
    console.error(err);
  }
});

bot.command("stats", async (ctx) => {
  if (!ctx.chat) {
    return;
  }

  const results: {
    [id: number]: { lols: number; score: number; username: string };
  } = {};

  const lols = await lolStore
    .scan()
    .whereAttribute("chatId")
    .equals(ctx.chat.id)
    .exec();

  lols.forEach((lol) => {
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
  });

  const values = Object.values(results);

  if (values.length === 0) {
    return;
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
});

dialogflowMiddleware(bot);

export { bot };

function createLolFromCtx(
  ctx: TelegrafContext,
  lolType: LolType
): Lol | undefined {
  const target = getTarget(ctx);

  if (!target || !ctx.chat || !ctx.from || !ctx.message?.reply_to_message) {
    return;
  }

  const fromUser = new User();
  fromUser.id = ctx.from.id;
  fromUser.username = ctx.from.username;

  const toUser = new User();
  toUser.id = target.id;
  toUser.username = target.username;

  const lol = new Lol();
  lol.id = uuidv4();
  lol.toUser = toUser;
  lol.fromUser = fromUser;
  lol.chatId = ctx.chat.id;
  lol.toMessageId = ctx.message?.reply_to_message?.message_id;
  lol.createdAt = new Date();
  lol.lolType = lolType;

  return lol;
}

async function saveLols(lols: Lol[]) {
  const savePromises = lols.map((lol) => lolStore.put(lol).exec());
  return await Promise.all(savePromises);
}

function getTarget(ctx: TelegrafContext) {
  if (!ctx.message || !ctx.message.reply_to_message) {
    return;
  }

  const target = ctx.message.reply_to_message.from;

  if (process.env.APP_ENV === "development") {
    return target;
  }

  if (!target || target.id === ctx.from?.id || target.is_bot) {
    return;
  }

  return target;
}

function getCleanText(ctx: TelegrafContext): string {
  if (!ctx.message || !ctx.message.text) {
    return "";
  }
  return ctx.message.text.trim().toLowerCase();
}

async function isLolExists(
  ctx: TelegrafContext,
  lolTypes: LolType[]
): Promise<boolean> {
  const targetMessageId = ctx.message?.reply_to_message?.message_id;

  if (!targetMessageId) {
    return false;
  }

  const searchResult = await lolStore
    .scan()
    .whereAttribute("fromUser.id")
    .equals(ctx.from?.id)
    .whereAttribute("toMessageId")
    .equals(targetMessageId)
    .exec();

  const existingLol = searchResult.find((lol) =>
    lolTypes.find((type) => lol.lolType === type)
  );

  return existingLol != null;
}
