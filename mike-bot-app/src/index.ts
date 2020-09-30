import express from "express";
import Telegraf from "telegraf";
import { TelegrafContext } from "telegraf/typings/context";
import fs from "fs";
import path from "path";

const file = fs.readFileSync(path.join(__dirname, "..", "q.txt"), "utf-8");
const questions = file.split("\n");
console.log(questions);

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
let answer = "";

app.get("/quiz", async (req, res) => {
  if (!req.query.chatId || typeof req.query.chatId !== "string") {
    console.error("missing chat id");
    return res.status(400).send("missing chat id");
  }

  const chatId = parseInt(req.query.chatId);

  if (req.query.answer && typeof req.query.answer === "string") {
    if (true) {
      bot.telegram.sendMessage(chatId, "правильно");
      answer = "";
    }
  } else {
    if (interval) {
      clearInterval(interval);
      interval = null;
      bot.telegram.sendMessage(chatId, `stopped`);
      console.log("stopped");
      return res.status(200).send({ message: "stopped" });
    } else {
      bot.telegram.sendMessage(chatId, `started`);
      interval = setInterval(() => {
        sendQ(chatId);
      }, 10000);
      console.log("started");
      return res.status(200).send({ message: "started" });
    }
  }
});

function sendQ(chatId: number) {
  const question = questions[Math.floor(Math.random() * questions.length)];
  const split = question.split("*");
  const q = split[0];
  answer = split[1];
  bot.telegram.sendMessage(chatId, q);
}

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
