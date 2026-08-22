import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Update } from "grammy/types";

import { handleTelegramUpdate } from "@/lib/bot/handle-update";
import { addRegistration } from "@/lib/db/registrations";
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
const OPENER_ID = 701;

/** A group message that makes the Chat and its opener known to the database. */
function groupMessageUpdate(updateId: number, actorId: number): Update {
  return {
    update_id: updateId,
    message: {
      message_id: 500,
      date: Math.floor(new Date("2026-08-10T12:00:00.000Z").getTime() / 1000),
      chat: { id: TEST_CHAT_ID, type: "supergroup", title: "Test" },
      from: {
        id: actorId,
        is_bot: false,
        first_name: "Opener",
        username: "opener",
      },
      text: "hello",
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

  it("returns a registered Chat after the opener registers in a group", async () => {
    const db = await getRuntimeDb();

    await handleTelegramUpdate(db, groupMessageUpdate(1, OPENER_ID));
    await addRegistration(db, TEST_CHAT_ID, OPENER_ID);

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
