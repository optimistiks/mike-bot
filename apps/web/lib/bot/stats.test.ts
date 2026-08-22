/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, it, vi } from "vitest";
import type { Context } from "grammy";
import type { Update, UserFromGetMe } from "grammy/types";

import { closePgliteDb, createPgliteDb } from "@/lib/db/pglite";
import { registrations } from "@/lib/db/schema";

import { createBot } from "./bot";
import {
  handleStatsCommand,
  miniAppLink,
  PRIVATE_STATS_MESSAGE_TEXT,
  STATS_MESSAGE_TEXT,
} from "./stats";

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

function context(chatType: "private" | "supergroup"): Context {
  return {
    chat:
      chatType === "private"
        ? { id: 100, type: "private", first_name: "User" }
        : { id: -100_123, type: "supergroup", title: "Test" },
    from: { id: 42, is_bot: false, first_name: "User" },
    me: { id: 777, is_bot: true, first_name: "Mike", username: "mike_bot" },
    reply: vi.fn().mockResolvedValue({}),
  } as unknown as Context;
}

describe("/stats", () => {
  it("registers a group caller and sends a Chat deep link idempotently", async () => {
    const pglite = await createPgliteDb();
    const ctx = context("supergroup");

    try {
      await handleStatsCommand(pglite.db, ctx);
      await handleStatsCommand(pglite.db, ctx);

      await expect(pglite.db.select().from(registrations)).resolves.toEqual([
        { chatId: -100_123, userId: 42 },
      ]);
      expect(ctx.reply).toHaveBeenCalledWith(STATS_MESSAGE_TEXT, {
        receiver_user_id: 42,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Открыть таблицы лидеров",
                url: "https://t.me/mike_bot?startapp=chat_-100123",
              },
            ],
          ],
        },
      });
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("sends the generic selector privately without Registration", async () => {
    const pglite = await createPgliteDb();
    const ctx = context("private");

    try {
      await handleStatsCommand(pglite.db, ctx);
      await expect(pglite.db.select().from(registrations)).resolves.toEqual([]);
      // No receiver_user_id: ephemeral replies are a group-only concept.
      expect(ctx.reply).toHaveBeenCalledWith(PRIVATE_STATS_MESSAGE_TEXT, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Открыть таблицы лидеров",
                url: "https://t.me/mike_bot?startapp",
              },
            ],
          ],
        },
      });
      expect(miniAppLink("mike_bot")).toBe("https://t.me/mike_bot?startapp");
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it.each(["/stats", "/register"] as const)(
    "%s registers the group caller and sends one ephemeral reply",
    async (command) => {
      const pglite = await createPgliteDb();
      const bot = createBot({ db: pglite.db, token: "test-token" });
      bot.botInfo = BOT_INFO;
      const payloads: { method: string; payload: unknown }[] = [];
      bot.api.config.use((_previous, method, payload) => {
        payloads.push({ method, payload });
        return Promise.resolve({
          ok: true,
          result: {
            message_id: 0,
            date: 1_787_000_000,
            chat: { id: -100_123, type: "supergroup", title: "Test" },
            from: BOT_INFO,
            text: STATS_MESSAGE_TEXT,
          },
        } as never);
      });

      try {
        await bot.handleUpdate({
          update_id: 300,
          message: {
            message_id: 51,
            date: 1_787_000_000,
            chat: { id: -100_123, type: "supergroup", title: "Test" },
            from: { id: 42, is_bot: false, first_name: "User" },
            text: command,
            entities: [
              { offset: 0, length: command.length, type: "bot_command" },
            ],
          },
        } satisfies Update);

        expect(payloads).toEqual([
          {
            method: "sendMessage",
            payload: expect.objectContaining({
              chat_id: -100_123,
              receiver_user_id: 42,
              text: STATS_MESSAGE_TEXT,
            }) as unknown,
          },
        ]);
        await expect(pglite.db.select().from(registrations)).resolves.toEqual([
          { chatId: -100_123, userId: 42 },
        ]);
      } finally {
        await closePgliteDb(pglite);
      }
    },
  );

  it("handles a retried group command only once", async () => {
    const pglite = await createPgliteDb();
    const bot = createBot({ db: pglite.db, token: "test-token" });
    bot.botInfo = BOT_INFO;
    const apiCalls: string[] = [];
    bot.api.config.use((_previous, method) => {
      apiCalls.push(method);
      return Promise.resolve({
        ok: true,
        result: {
          message_id: 99,
          date: 1_787_000_000,
          chat: { id: -100_123, type: "supergroup", title: "Test" },
          from: BOT_INFO,
          text: STATS_MESSAGE_TEXT,
        },
      } as never);
    });
    const update = {
      update_id: 200,
      message: {
        message_id: 50,
        date: 1_787_000_000,
        chat: { id: -100_123, type: "supergroup", title: "Test" },
        from: { id: 42, is_bot: false, first_name: "User" },
        text: "/stats",
        entities: [{ offset: 0, length: 6, type: "bot_command" }],
      },
    } satisfies Update;

    try {
      await bot.handleUpdate(update);
      await bot.handleUpdate(update);
      expect(
        apiCalls.filter((method) => method === "sendMessage"),
      ).toHaveLength(1);
      await expect(pglite.db.select().from(registrations)).resolves.toEqual([
        { chatId: -100_123, userId: 42 },
      ]);
    } finally {
      await closePgliteDb(pglite);
    }
  });
});
