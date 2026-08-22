/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, it, vi } from "vitest";
import type { Context } from "grammy";
import type { Update, UserFromGetMe } from "grammy/types";

import { closePgliteDb, createPgliteDb } from "@/lib/db/pglite";
import { registrationMessages } from "@/lib/db/schema";

import { isGroupChat } from "./chat";
import {
  handleRegisterCommand,
  isChatAdminStatus,
  recordRegistrationMessage,
  REGISTER_ADMIN_ONLY_MESSAGE,
  REGISTER_GROUP_ONLY_MESSAGE,
  REGISTRATION_MESSAGE_TEXT,
} from "./register";
import { getMessageAuthor } from "./handle-update";
import { createBot } from "./bot";

const TEST_CHAT_ID = -100_111_222;
const BOT_USER_ID = 777;

const BOT_INFO: UserFromGetMe = {
  id: BOT_USER_ID,
  is_bot: true,
  first_name: "Mike",
  username: "mike_bot",
  can_join_groups: true,
  can_read_all_group_messages: true,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
  has_topics_enabled: false,
  allows_users_to_create_topics: false,
  can_manage_bots: false,
  supports_join_request_queries: false,
};

function registerUpdate(updateId: number): Update {
  return {
    update_id: updateId,
    message: {
      message_id: 400,
      date: 1_722_513_600,
      chat: { id: TEST_CHAT_ID, type: "supergroup", title: "Test" },
      from: { id: 900, is_bot: false, first_name: "Admin" },
      text: "/register",
      entities: [{ offset: 0, length: 9, type: "bot_command" }],
    },
  };
}

function mockRegisterContext(options: {
  chatType: "private" | "supergroup";
  adminStatus?: "administrator" | "member";
}): Context {
  const reply = vi.fn().mockResolvedValue({
    message_id: 500,
    date: 1_722_513_600,
  });
  const getChatMember = vi.fn().mockResolvedValue({
    status: options.adminStatus ?? "administrator",
  });

  return {
    chat:
      options.chatType === "private"
        ? { id: 123, type: "private" }
        : { id: TEST_CHAT_ID, type: "supergroup", title: "Test" },
    from: { id: 900, is_bot: false, first_name: "Admin" },
    me: { id: BOT_USER_ID, is_bot: true, first_name: "Mike" },
    reply,
    getChatMember,
  } as unknown as Context;
}

describe("register command guards", () => {
  it.each([
    ["group", true],
    ["supergroup", true],
    ["private", false],
    ["channel", false],
  ] as const)("isGroupChat(%s) is %s", (chatType, expected) => {
    expect(isGroupChat(chatType)).toBe(expected);
  });

  it.each([
    ["creator", true],
    ["administrator", true],
    ["member", false],
    ["left", false],
  ] as const)("isChatAdminStatus(%s) is %s", (status, expected) => {
    expect(isChatAdminStatus(status)).toBe(expected);
  });

  it("replies with Russian error in private chat", async () => {
    const pglite = await createPgliteDb();
    const ctx = mockRegisterContext({ chatType: "private" });

    try {
      await handleRegisterCommand(pglite.db, ctx);

      expect(ctx.reply).toHaveBeenCalledWith(REGISTER_GROUP_ONLY_MESSAGE);
      const rows = await pglite.db.select().from(registrationMessages);
      expect(rows).toHaveLength(0);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("replies with Russian error for non-admin in a group", async () => {
    const pglite = await createPgliteDb();
    const ctx = mockRegisterContext({
      chatType: "supergroup",
      adminStatus: "member",
    });

    try {
      await handleRegisterCommand(pglite.db, ctx);

      expect(ctx.reply).toHaveBeenCalledWith(REGISTER_ADMIN_ONLY_MESSAGE);
      const rows = await pglite.db.select().from(registrationMessages);
      expect(rows).toHaveLength(0);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("posts and records a Registration message for a group admin", async () => {
    const pglite = await createPgliteDb();
    const ctx = mockRegisterContext({ chatType: "supergroup" });

    try {
      await handleRegisterCommand(pglite.db, ctx);

      expect(ctx.reply).toHaveBeenCalledWith(REGISTRATION_MESSAGE_TEXT);

      const rows = await pglite.db.select().from(registrationMessages);
      expect(rows).toEqual([
        expect.objectContaining({
          chatId: TEST_CHAT_ID,
          messageId: 500,
        }),
      ]);

      const cached = await getMessageAuthor(pglite.db, TEST_CHAT_ID, 500);
      expect(cached).toMatchObject({
        authorId: BOT_USER_ID,
        authorIsBot: true,
      });
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("handles a retried /register update only once", async () => {
    const pglite = await createPgliteDb();
    const bot = createBot({ db: pglite.db, token: "test-token" });
    bot.botInfo = BOT_INFO;

    const apiCalls: string[] = [];
    bot.api.config.use(async (previous, method, payload, signal) => {
      apiCalls.push(method);
      if (method === "getChatMember") {
        return {
          ok: true,
          result: {
            status: "administrator",
            user: { id: 900, is_bot: false, first_name: "Admin" },
          },
        } as never;
      }
      if (method === "sendMessage") {
        return {
          ok: true,
          result: {
            message_id: 500,
            date: 1_722_513_600,
            chat: { id: TEST_CHAT_ID, type: "supergroup", title: "Test" },
            from: BOT_INFO,
            text: REGISTRATION_MESSAGE_TEXT,
          },
        } as never;
      }
      return previous(method, payload, signal);
    });

    try {
      const update = registerUpdate(123);
      await bot.handleUpdate(update);
      await bot.handleUpdate(update);

      expect(
        apiCalls.filter((method) => method === "getChatMember"),
      ).toHaveLength(1);
      expect(
        apiCalls.filter((method) => method === "sendMessage"),
      ).toHaveLength(1);
      await expect(
        pglite.db.select().from(registrationMessages),
      ).resolves.toHaveLength(1);
    } finally {
      await closePgliteDb(pglite);
    }
  });
});

describe("recordRegistrationMessage", () => {
  it("is idempotent for the same Registration message", async () => {
    const pglite = await createPgliteDb();

    try {
      const params = {
        chatId: TEST_CHAT_ID,
        messageId: 501,
        botUserId: BOT_USER_ID,
        messageDate: 1_722_513_600,
      };

      await recordRegistrationMessage(pglite.db, params);
      await recordRegistrationMessage(pglite.db, params);

      const rows = await pglite.db.select().from(registrationMessages);
      expect(rows).toHaveLength(1);
    } finally {
      await closePgliteDb(pglite);
    }
  });
});
