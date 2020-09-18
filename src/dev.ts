import { bot } from "./bot";

bot
  .launch()
  .then(() => {
    console.log("started in dev mode");
  })
  .catch((err) => {
    console.error(err, "failed to start in dev mode");
  });
