import { describe, expect, it, vi } from "vitest";
import type { Context } from "grammy";
import type { Update, UserFromGetMe } from "grammy/types";

import { closePgliteDb, createPgliteDb } from "@/lib/db/pglite";
import { events, messageAuthors } from "@/lib/db/schema";

import { createBot } from "./bot";
import { handleReplyMark, replyTextToEventType } from "./reply-marks";

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

function context(options: {
  text?: string;
  actorId?: number;
  subjectId?: number;
  subjectIsBot?: boolean;
  chatType?: "private" | "supergroup";
  reply?: boolean;
}): Context {
  const subjectId = options.subjectId ?? 20;
  return {
    chat:
      options.chatType === "private"
        ? { id: CHAT_ID, type: "private" }
        : { id: CHAT_ID, type: "supergroup", title: "Test" },
    from: {
      id: options.actorId ?? 10,
      is_bot: false,
      first_name: "Actor",
    },
    message: {
      message_id: 31,
      date: MESSAGE_DATE + 60,
      chat: { id: CHAT_ID, type: "supergroup", title: "Test" },
      from: { id: options.actorId ?? 10, is_bot: false, first_name: "Actor" },
      text: options.text ?? "+",
      ...(options.reply === false
        ? {}
        : {
            reply_to_message: {
              message_id: 30,
              date: MESSAGE_DATE,
              chat: { id: CHAT_ID, type: "supergroup", title: "Test" },
              from: {
                id: subjectId,
                is_bot: options.subjectIsBot ?? false,
                first_name: "Subject",
              },
            },
          }),
    },
    react: vi.fn(),
  } as unknown as Context;
}

describe("reply Marks", () => {
  it.each([
    [" + ", "karma.plus"],
    ["-", "karma.minus"],
    ["ЛоЛ", "humor.add"],
    ["++", null],
  ])("maps exact reply %j to %s", (text, expected) => {
    expect(replyTextToEventType(text)).toBe(expected);
  });

  it("creates one permanent Event and suppresses duplicate acknowledgement", async () => {
    const pglite = await createPgliteDb();
    await pglite.db.insert(messageAuthors).values({
      chatId: CHAT_ID,
      messageId: 30,
      authorId: 20,
      authorIsBot: false,
      messageDate: MESSAGE_DATE,
    });

    try {
      const ctx = context({ text: "+" });
      await expect(handleReplyMark(pglite.db, ctx)).resolves.toBe(true);
      await expect(handleReplyMark(pglite.db, ctx)).resolves.toBe(false);
      await expect(pglite.db.select().from(events)).resolves.toEqual([
        expect.objectContaining({
          type: "karma.plus",
          reversible: false,
          reversesEventId: null,
        }),
      ]);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("allows permanent plus and minus replies to cancel in scoring", async () => {
    const pglite = await createPgliteDb();
    await pglite.db.insert(messageAuthors).values({
      chatId: CHAT_ID,
      messageId: 30,
      authorId: 20,
      authorIsBot: false,
      messageDate: MESSAGE_DATE,
    });

    try {
      await expect(
        handleReplyMark(pglite.db, context({ text: "+" })),
      ).resolves.toBe(true);
      await expect(
        handleReplyMark(pglite.db, context({ text: "-" })),
      ).resolves.toBe(true);
      const rows = await pglite.db.select().from(events);
      expect(rows.map((row) => row.type)).toEqual([
        "karma.plus",
        "karma.minus",
      ]);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("acknowledges an accepted reply with one supported reaction and never deletes it", async () => {
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

    try {
      await bot.handleUpdate(update);
      expect(apiCalls).toEqual([
        {
          method: "setMessageReaction",
          payload: {
            chat_id: CHAT_ID,
            message_id: 31,
            reaction: [{ type: "emoji", emoji: "👍" }],
          },
        },
      ]);
      expect(apiCalls.some(({ method }) => method === "deleteMessage")).toBe(
        false,
      );
      await expect(pglite.db.select().from(messageAuthors)).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            chatId: CHAT_ID,
            messageId: 30,
            authorId: 20,
          }),
        ]),
      );
      await expect(pglite.db.select().from(events)).resolves.toHaveLength(1);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it.each([
    ["self", context({ actorId: 20, subjectId: 20 })],
    ["bot", context({ subjectIsBot: true })],
    ["private", context({ chatType: "private" })],
    ["non-reply", context({ reply: false })],
  ])("rejects a %s reply", async (_name, ctx) => {
    const pglite = await createPgliteDb();
    try {
      await expect(handleReplyMark(pglite.db, ctx)).resolves.toBe(false);
      await expect(pglite.db.select().from(events)).resolves.toEqual([]);
    } finally {
      await closePgliteDb(pglite);
    }
  });
});
