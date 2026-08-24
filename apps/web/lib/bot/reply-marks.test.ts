import { describe, expect, it } from "vitest";
import type { Update, UserFromGetMe } from "grammy/types";

import { closePgliteDb, createPgliteDb } from "@/lib/db/pglite";
import { marks, messageAuthors } from "@/lib/db/schema";

import { createBot } from "./bot";
import { acknowledgementText, replyTextToMarkType } from "./reply-marks";

const CHAT_ID = -100_123;
const MESSAGE_DATE = Math.floor(
  new Date("2026-08-10T11:00:00.000Z").getTime() / 1_000,
);
const BOT_INFO: UserFromGetMe = {
  id: 777,
  is_bot: true,
  first_name: "Mike",
  username: "mike_bot",
  can_join_groups: true,
  can_read_all_group_messages: true,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: true,
  has_topics_enabled: false,
  allows_users_to_create_topics: false,
  can_manage_bots: false,
  supports_join_request_queries: false,
};

// Which replies are Scoring replies, and who they may mark, is decided by
// `readUpdate` and covered without a database in read-update.test.ts. What is
// left here is the vocabulary itself and the one path that reaches Telegram.
describe("reply Marks", () => {
  it.each([
    [" + ", "karma.plus"],
    ["-", "karma.minus"],
    ["ЛоЛ", "humor.add"],
    ["++", null],
  ])("maps exact reply %j to %s", (text, expected) => {
    expect(replyTextToMarkType(text)).toBe(expected);
  });

  it("names the Actor without mentioning them", () => {
    // An "@" here is a real mention: the bot answers every Mark an Actor
    // gives, so it would notify them for their own routine reactions.
    expect(
      acknowledgementText("humor.add", {
        username: "actor",
        first_name: "Actor",
      }),
    ).toBe("лол (actor)");
    expect(acknowledgementText("karma.plus", { first_name: "Actor" })).toBe(
      "➕ (Actor)",
    );
  });

  it("replaces an accepted reply with the bot's own announcement", async () => {
    const pglite = await createPgliteDb();
    const bot = createBot({ db: pglite.db, token: "test-token" });
    bot.botInfo = BOT_INFO;
    const apiCalls: { method: string; payload: unknown }[] = [];
    bot.api.config.use((_previous, method, payload) => {
      apiCalls.push({ method, payload });
      return Promise.resolve({ ok: true, result: true } as never);
    });
    const update = {
      update_id: 100,
      message: {
        message_id: 31,
        date: MESSAGE_DATE + 60,
        chat: { id: CHAT_ID, type: "supergroup", title: "Test" },
        from: { id: 10, is_bot: false, first_name: "Actor", username: "actor" },
        text: "лол",
        reply_to_message: {
          message_id: 30,
          date: MESSAGE_DATE,
          chat: { id: CHAT_ID, type: "supergroup", title: "Test" },
          from: { id: 20, is_bot: false, first_name: "Subject" },
          text: "hello",
          reply_to_message: undefined,
        },
      },
    } satisfies Update;

    try {
      await bot.handleUpdate(update);
      expect(apiCalls).toEqual([
        {
          method: "deleteMessage",
          payload: { chat_id: CHAT_ID, message_id: 31 },
        },
        {
          method: "sendMessage",
          payload: {
            chat_id: CHAT_ID,
            text: "лол (actor)",
            reply_parameters: { message_id: 30 },
          },
        },
      ]);
      await expect(pglite.db.select().from(messageAuthors)).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            chatId: CHAT_ID,
            messageId: 30,
            authorId: 20,
          }),
        ]),
      );
      await expect(pglite.db.select().from(marks)).resolves.toHaveLength(1);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("says nothing when the reply spends no grant", async () => {
    const pglite = await createPgliteDb();
    const bot = createBot({ db: pglite.db, token: "test-token" });
    bot.botInfo = BOT_INFO;
    const apiCalls: string[] = [];
    bot.api.config.use((_previous, method) => {
      apiCalls.push(method);
      return Promise.resolve({ ok: true, result: true } as never);
    });

    function plusReply(updateId: number): Update {
      return {
        update_id: updateId,
        message: {
          message_id: 30 + updateId,
          date: MESSAGE_DATE + 60,
          chat: { id: CHAT_ID, type: "supergroup", title: "Test" },
          from: { id: 10, is_bot: false, first_name: "Actor" },
          text: "+",
          reply_to_message: {
            message_id: 30,
            date: MESSAGE_DATE,
            chat: { id: CHAT_ID, type: "supergroup", title: "Test" },
            from: { id: 20, is_bot: false, first_name: "Subject" },
            text: "hello",
            reply_to_message: undefined,
          },
        },
      } satisfies Update;
    }

    try {
      // The grant is spent once. The second reply is refused, and a refused
      // Scoring reply is left in the Chat untouched and unanswered.
      await bot.handleUpdate(plusReply(1));
      await bot.handleUpdate(plusReply(2));

      expect(apiCalls.filter((method) => method === "sendMessage")).toEqual([
        "sendMessage",
      ]);
      await expect(pglite.db.select().from(marks)).resolves.toHaveLength(1);
    } finally {
      await closePgliteDb(pglite);
    }
  });
});
