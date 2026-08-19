import { afterEach, describe, expect, it } from "vitest";
import type { ReactionType, Update } from "grammy/types";

import { handleTelegramUpdate } from "@/lib/bot/handle-update";
import { recordRegistrationPin } from "@/lib/bot/register";
import { getRuntimeDb, resetRuntimeDbForTests } from "@/lib/db/runtime";
import { chatMembers, chatMemberships, events } from "@/lib/db/schema";

import { GET } from "./route";

const TEST_CHAT_ID = -100_111_222;
const BOT_USER_ID = 777;
const REGISTRATION_PIN_ID = 500;
const OPENER_ID = 701;

function tmaAuthorization(userId: number): string {
  const initData = `user=${encodeURIComponent(JSON.stringify({ id: userId }))}`;
  return `tma ${initData}`;
}

function reactionUpdate(
  updateId: number,
  messageId: number,
  actorId: number,
): Update {
  return {
    update_id: updateId,
    message_reaction: {
      chat: { id: TEST_CHAT_ID, type: "supergroup", title: "Test" },
      message_id: messageId,
      user: {
        id: actorId,
        is_bot: false,
        first_name: "Opener",
        username: "opener",
      },
      date: Math.floor(new Date("2026-08-10T12:00:00.000Z").getTime() / 1000),
      old_reaction: [] as ReactionType[],
      new_reaction: [{ type: "emoji", emoji: "👍" }],
    },
  };
}

describe("GET /api/chats", () => {
  afterEach(async () => {
    await resetRuntimeDbForTests();
  });

  it("returns empty chats for an unregistered opener", async () => {
    const db = await getRuntimeDb();
    const response = await GET(
      new Request("http://localhost/api/chats", {
        headers: { authorization: tmaAuthorization(OPENER_ID) },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ chats: [] });
    await expect(db.select().from(events)).resolves.toEqual([]);
    await expect(db.select().from(chatMembers)).resolves.toEqual([]);
    await expect(db.select().from(chatMemberships)).resolves.toEqual([]);
  });

  it("returns registered chat after pin reaction", async () => {
    const db = await getRuntimeDb();

    await recordRegistrationPin(db, {
      chatId: TEST_CHAT_ID,
      messageId: REGISTRATION_PIN_ID,
      botUserId: BOT_USER_ID,
      messageDate: 1_722_513_600,
    });

    await handleTelegramUpdate(
      db,
      reactionUpdate(1, REGISTRATION_PIN_ID, OPENER_ID),
    );

    const response = await GET(
      new Request("http://localhost/api/chats", {
        headers: { authorization: tmaAuthorization(OPENER_ID) },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      chats: [{ chatId: TEST_CHAT_ID, label: "Чат -100111222" }],
    });
  });
});
