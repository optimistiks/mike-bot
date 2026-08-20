import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getRuntimeDb, resetRuntimeDbForTests } from "@/lib/db/runtime";
import { chatMembers, chatMemberships, events } from "@/lib/db/schema";
import {
  PRIMARY_FIXTURE_CHAT_ID,
  REGISTERED_PERSONA_ID,
  resetAndSeedDatabase,
  SECONDARY_FIXTURE_CHAT_ID,
} from "@/lib/db/seed";
import { signDevelopmentInitDataForPersona } from "@/lib/mini-app/development-init-data.server";
import {
  signedTmaAuthorization,
  TEST_BOT_TOKEN,
  TEST_DEVELOPMENT_BOT_TOKEN,
} from "@/test/tma-init-data";

import { GET } from "./route";

const FIXTURE_NOW = new Date("2026-08-15T12:00:00.000Z");

function leaderboardRequest(
  query: string,
  authorization = signedTmaAuthorization(REGISTERED_PERSONA_ID),
): Request {
  return new Request(`http://localhost/api/leaderboard?${query}`, {
    headers: { authorization },
  });
}

describe("GET /api/leaderboard", () => {
  beforeEach(() => {
    process.env.BOT_TOKEN = TEST_BOT_TOKEN;
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    delete process.env.BOT_TOKEN;
    await resetRuntimeDbForTests();
  });

  it("returns a leaderboard to a registered member", async () => {
    const db = await getRuntimeDb();
    await resetAndSeedDatabase(db, FIXTURE_NOW);

    const response = await GET(
      leaderboardRequest(
        `chat_id=${String(PRIMARY_FIXTURE_CHAT_ID)}&year=2026&month=8`,
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      chatId: PRIMARY_FIXTURE_CHAT_ID,
      season: { year: 2026, month: 8 },
    });
  });

  it("does not create fixture rows while reading a leaderboard", async () => {
    const db = await getRuntimeDb();
    const response = await GET(
      leaderboardRequest(
        `chat_id=${String(PRIMARY_FIXTURE_CHAT_ID)}&year=2026&month=8`,
      ),
    );

    expect(response.status).toBe(403);
    await expect(db.select().from(events)).resolves.toEqual([]);
    await expect(db.select().from(chatMembers)).resolves.toEqual([]);
    await expect(db.select().from(chatMemberships)).resolves.toEqual([]);
  });

  it("returns the stable 403 response for a Chat without membership", async () => {
    const db = await getRuntimeDb();
    await resetAndSeedDatabase(db, FIXTURE_NOW);

    const response = await GET(
      leaderboardRequest(
        `chat_id=${String(SECONDARY_FIXTURE_CHAT_ID)}&year=2026&month=8`,
      ),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("forbids the signed development persona from a different seeded Chat", async () => {
    const db = await getRuntimeDb();
    await resetAndSeedDatabase(db, FIXTURE_NOW);
    const initDataRaw = signDevelopmentInitDataForPersona("forbidden", {
      env: { TMA_DEVELOPMENT_BOT_TOKEN: TEST_DEVELOPMENT_BOT_TOKEN },
    });
    vi.stubEnv("TMA_DEVELOPMENT_BOT_TOKEN", TEST_DEVELOPMENT_BOT_TOKEN);

    const response = await GET(
      leaderboardRequest(
        `chat_id=${String(PRIMARY_FIXTURE_CHAT_ID)}&year=2026&month=8`,
        `tma ${String(initDataRaw)}`,
      ),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("returns 400 for malformed query parameters after authentication", async () => {
    const response = await GET(
      leaderboardRequest(
        `chat_id=${String(PRIMARY_FIXTURE_CHAT_ID)}&year=2026`,
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid query parameters",
    });
  });

  it.each([
    ["missing", undefined],
    ["malformed", "tma not-init-data"],
    [
      "bad signature",
      signedTmaAuthorization(
        REGISTERED_PERSONA_ID,
        new Date(),
        "987654321:WRONG_TOKEN",
      ),
    ],
    [
      "expired",
      signedTmaAuthorization(
        REGISTERED_PERSONA_ID,
        new Date(Date.now() - 366 * 24 * 60 * 60 * 1_000),
      ),
    ],
  ])("returns the stable 401 response for %s init data", async (_, header) => {
    const response = await GET(
      new Request(
        `http://localhost/api/leaderboard?chat_id=${String(PRIMARY_FIXTURE_CHAT_ID)}&year=2026&month=8`,
        { headers: header ? { authorization: header } : undefined },
      ),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });
});
