import "reflect-metadata";
import express from "express";
import { json } from "body-parser";
import { bot } from "./bot";

const app = express();
app.use(json());

app.get("/setWebhook", async (req, res) => {
  if (!process.env.BOT_URL) {
    return res.status(500).send({ message: "missing bot url" });
  }
  try {
    await bot.telegram.setWebhook(process.env.BOT_URL);
    return res.status(200).send({ message: "webhook set" });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .send({ message: err.message || "could not set webhook" });
  }
});

app.post("/", async (req, res) => {
  try {
    await bot.handleUpdate(req.body);
    return res.status(200).send({ message: "ok" });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .send({ message: err.message || "could not handle update" });
  }
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(
    `Example app listening at http://localhost:${port}`,
    process.env.TEST
  );
});
