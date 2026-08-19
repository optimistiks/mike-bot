/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, it, vi } from "vitest";
import type { Context } from "grammy";

import { closePgliteDb, createPgliteDb } from "@/lib/db/pglite";
import { registrationMessages } from "@/lib/db/schema";

import {
  handleRegisterCommand,
  isChatAdminStatus,
  isGroupChat,
  recordRegistrationPin,
  REGISTER_ADMIN_ONLY_MESSAGE,
  REGISTER_GROUP_ONLY_MESSAGE,
  REGISTRATION_PIN_TEXT,
} from "./register";
import { getMessageAuthor } from "./handle-update";

const TEST_CHAT_ID = -100_111_222;
const BOT_USER_ID = 777;

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

  it("posts pin and records registration_messages for group admin", async () => {
    const pglite = await createPgliteDb();
    const ctx = mockRegisterContext({ chatType: "supergroup" });

    try {
      await handleRegisterCommand(pglite.db, ctx);

      expect(ctx.reply).toHaveBeenCalledWith(REGISTRATION_PIN_TEXT);

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
});

describe("recordRegistrationPin", () => {
  it("is idempotent for the same pin", async () => {
    const pglite = await createPgliteDb();

    try {
      const params = {
        chatId: TEST_CHAT_ID,
        messageId: 501,
        botUserId: BOT_USER_ID,
        messageDate: 1_722_513_600,
      };

      await recordRegistrationPin(pglite.db, params);
      await recordRegistrationPin(pglite.db, params);

      const rows = await pglite.db.select().from(registrationMessages);
      expect(rows).toHaveLength(1);
    } finally {
      await closePgliteDb(pglite);
    }
  });
});
