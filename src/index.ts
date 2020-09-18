import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
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
        performer: "@MikeLitorisOmgBot",
        caption: "@MikeLitorisOmgBot",
      }
    );
  } catch (err) {
    console.error(err);
  }

  return next();
});

export const lambda = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("request", event.body);

  if (event.body) {
    const request = JSON.parse(event.body);
    await bot.handleUpdate(request);
  }

  const result = {
    statusCode: 200,
    body: JSON.stringify({ result: "ok" }),
    headers: { "content-type": "application/json" },
  };

  return result;
};
