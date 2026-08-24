import { describe, expect, it, vi } from "vitest";
import type { Update, UserFromGetMe } from "grammy/types";

import { closePgliteDb, createPgliteDb } from "@/lib/db/pglite";
import { registrations } from "@/lib/db/schema";

import { createBot } from "./bot";
import { miniAppLink, STATS_MESSAGE_TEXT } from "./stats";

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

// Who may call /stats, and what it establishes, is decided by `readUpdate` and
// covered without a database in read-update.test.ts. These are the paths that
// reach Telegram.
describe("/stats", () => {
  it("builds the Chat-scoped and generic Mini App links", () => {
    expect(miniAppLink("mike_bot", -100_123)).toBe(
      "https://t.me/mike_bot?startapp=chat_-100123",
    );
    expect(miniAppLink("mike_bot")).toBe("https://t.me/mike_bot?startapp");
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

  it("keeps the Registration when Telegram refuses the reply", async () => {
    const pglite = await createPgliteDb();
    const bot = createBot({ db: pglite.db, token: "test-token" });
    bot.botInfo = BOT_INFO;
    // The refusal is the point of this test, and the bot reports it. Capture
    // the report rather than letting a deliberate failure print a stack trace
    // over every run — and assert it, since staying quiet would be the bug.
    const reported = vi.spyOn(console, "error").mockImplementation(() => {
      /* captured */
    });
    bot.api.config.use((_previous, method) =>
      method === "sendMessage"
        ? Promise.reject(new Error("Bad Request: not enough rights"))
        : Promise.resolve({ ok: true, result: true } as never),
    );

    try {
      // The Registration is a fact about the caller, not about the reply. A
      // send the bot has no rights for must not roll it back — and must not
      // hold a transaction open across a network round trip either.
      await bot.handleUpdate({
        update_id: 400,
        message: {
          message_id: 52,
          date: 1_787_000_000,
          chat: { id: -100_123, type: "supergroup", title: "Test" },
          from: { id: 42, is_bot: false, first_name: "User" },
          text: "/stats",
          entities: [{ offset: 0, length: 6, type: "bot_command" }],
        },
      } satisfies Update);

      await expect(pglite.db.select().from(registrations)).resolves.toEqual([
        { chatId: -100_123, userId: 42 },
      ]);
      expect(reported).toHaveBeenCalledWith(
        "failed to answer in the Chat",
        expect.objectContaining({ message: "Bad Request: not enough rights" }),
      );
    } finally {
      reported.mockRestore();
      await closePgliteDb(pglite);
    }
  });

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
