import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactionType, Update } from "grammy/types";

import { handleTelegramUpdate } from "@/lib/bot/handle-update";
import { recordRegistrationMessage } from "@/lib/bot/register";
import { getRuntimeDb, resetRuntimeDbForTests } from "@/lib/db/runtime";
import { displayIdentities, events, registrations } from "@/lib/db/schema";
import { PRIMARY_FIXTURE_CHAT_ID, resetAndSeedDatabase } from "@/lib/db/seed";
import { signDevelopmentInitDataForPersona } from "@/lib/mini-app/development-init-data.server";
import {
  signedTmaAuthorization,
  TEST_BOT_TOKEN,
  TEST_DEVELOPMENT_BOT_TOKEN,
} from "@/test/tma-init-data";

import { GET } from "./route";

const TEST_CHAT_ID = -100_111_222;
const BOT_USER_ID = 777;
const REGISTRATION_MESSAGE_ID = 500;
const OPENER_ID = 701;

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
  beforeEach(() => {
    process.env.BOT_TOKEN = TEST_BOT_TOKEN;
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    delete process.env.BOT_TOKEN;
    await resetRuntimeDbForTests();
  });

  it("returns empty chats for an unregistered opener", async () => {
    const db = await getRuntimeDb();
    const response = await GET(
      new Request("http://localhost/api/chats", {
        headers: { authorization: signedTmaAuthorization(OPENER_ID) },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ chats: [] });
    await expect(db.select().from(events)).resolves.toEqual([]);
    await expect(db.select().from(displayIdentities)).resolves.toEqual([]);
    await expect(db.select().from(registrations)).resolves.toEqual([]);
  });

  it("returns a registered Chat after a Registration-message reaction", async () => {
    const db = await getRuntimeDb();

    await recordRegistrationMessage(db, {
      chatId: TEST_CHAT_ID,
      messageId: REGISTRATION_MESSAGE_ID,
      botUserId: BOT_USER_ID,
      messageDate: 1_722_513_600,
    });

    await handleTelegramUpdate(
      db,
      reactionUpdate(1, REGISTRATION_MESSAGE_ID, OPENER_ID),
    );

    const response = await GET(
      new Request("http://localhost/api/chats", {
        headers: { authorization: signedTmaAuthorization(OPENER_ID) },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      chats: [{ chatId: TEST_CHAT_ID, title: "Test", photoVersion: null }],
    });
  });

  it.each([
    [
      "registered",
      [
        {
          chatId: PRIMARY_FIXTURE_CHAT_ID,
          title: "Клуб пятничных созвонов",
          photoVersion: null,
        },
      ],
    ],
    ["unregistered", []],
  ] as const)(
    "uses the signed development %s persona through the protected API",
    async (persona, expectedChats) => {
      const db = await getRuntimeDb();
      await resetAndSeedDatabase(db);
      const initDataRaw = signDevelopmentInitDataForPersona(persona, {
        env: { TMA_DEVELOPMENT_BOT_TOKEN: TEST_DEVELOPMENT_BOT_TOKEN },
      });
      vi.stubEnv("TMA_DEVELOPMENT_BOT_TOKEN", TEST_DEVELOPMENT_BOT_TOKEN);

      const response = await GET(
        new Request("http://localhost/api/chats", {
          headers: { authorization: `tma ${String(initDataRaw)}` },
        }),
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ chats: expectedChats });
    },
  );

  it.each([
    ["missing", undefined],
    ["malformed", "tma not-init-data"],
    [
      "bad signature",
      signedTmaAuthorization(OPENER_ID, new Date(), "987654321:WRONG_TOKEN"),
    ],
    [
      "expired",
      signedTmaAuthorization(
        OPENER_ID,
        new Date(Date.now() - 366 * 24 * 60 * 60 * 1_000),
      ),
    ],
  ])("returns the stable 401 response for %s init data", async (_, header) => {
    const response = await GET(
      new Request("http://localhost/api/chats", {
        headers: header ? { authorization: header } : undefined,
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });
});
