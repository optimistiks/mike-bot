import Telegraf from "telegraf";
import { TelegrafContext } from "telegraf/typings/context";
import dialogflow from "@google-cloud/dialogflow";
import { v4 as uuidv4 } from "uuid";
import { ChatSession, chatSessionStore } from "../model/chatSession";

export function dialogflowMiddleware(bot: Telegraf<TelegrafContext>): void {
  bot.on("message", async (ctx) => {
    if (!process.env.GOOGLE_PROJECT_ID || !process.env.GOOGLE_PRIVATE_KEY) {
      return;
    }

    if (!ctx.from || !ctx.message || !ctx.chat) {
      return;
    }

    let activeSession = await chatSessionStore
      .scan()
      .whereAttribute("userId")
      .equals(ctx.from.id)
      .whereAttribute("chatId")
      .equals(ctx.chat.id)
      .execSingle();

    if (!activeSession) {
      activeSession = new ChatSession();
      activeSession.id = uuidv4();
      activeSession.userId = ctx.from.id;
      activeSession.chatId = ctx.chat.id;
      activeSession.createdAt = new Date();
      await chatSessionStore.put(activeSession).exec();
    }

    // A unique identifier for the given session
    const { id: sessionId } = activeSession;

    // Create a new session
    const sessionClient = new dialogflow.SessionsClient({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      },
    });

    const sessionPath = sessionClient.projectAgentSessionPath(
      process.env.GOOGLE_PROJECT_ID,
      sessionId
    );

    // The text query request.
    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          // The query to send to the dialogflow agent
          text: ctx.message.text,
          // The language used by the client (en-US)
          languageCode: "ru-RU",
        },
      },
    };

    // Send request and log result
    const responses = await sessionClient.detectIntent(request);
    const result = responses[0].queryResult;

    if (result && result.fulfillmentText) {
      await ctx.reply(result.fulfillmentText, {
        reply_to_message_id: ctx.message?.message_id,
      });
    }
  });
}
