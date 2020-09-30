import express from "express";
import Telegraf from "telegraf";
import { TelegrafContext } from "telegraf/typings/context";

if (!process.env.BOT_KEY || !process.env.BOT_USERNAME) {
  throw new Error("Missing BOT_KEY or BOT_USERNAME");
}

const bot = new Telegraf(process.env.BOT_KEY, {
  username: process.env.BOT_USERNAME,
});

bot.catch((err: Error, ctx: TelegrafContext) => {
  console.error("bot error", {
    error: err.message,
    chatId: ctx.chat?.id,
    updateType: ctx.updateType,
    message: ctx.message?.text,
    messageId: ctx.message?.message_id,
    userId: ctx.from?.id,
  });
});

const app = express();
const port = process.env.PORT || 3001;

let interval: NodeJS.Timeout | null = null;

app.get("/quiz", async (req, res) => {
  if (!req.query.chatId || typeof req.query.chatId !== "string") {
    console.error("missing chat id");
    return res.status(400).send("missing chat id");
  }

  const chatId = parseInt(req.query.chatId);

  if (interval) {
    clearInterval(interval);
    interval = null;
    bot.telegram.sendMessage(chatId, `stopped`);
    console.log("stopped");
    return res.status(200).send({ message: "stopped" });
  } else {
    interval = setInterval(() => {
      bot.telegram.sendMessage(chatId, `yo ${Date.now()}`);
    }, 10000);
    bot.telegram.sendMessage(chatId, `started`);
    console.log("started");
    return res.status(200).send({ message: "started" });
  }
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
