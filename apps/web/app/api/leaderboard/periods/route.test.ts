import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getRuntimeDb, resetRuntimeDbForTests } from "@/lib/db/runtime";
import {
  PRIMARY_FIXTURE_CHAT_ID,
  REGISTERED_PERSONA_ID,
  resetAndSeedDatabase,
  SECONDARY_FIXTURE_CHAT_ID,
} from "@/lib/db/seed";
import { signedTmaAuthorization, TEST_BOT_TOKEN } from "@/test/tma-init-data";

import { GET } from "./route";

const FIXTURE_NOW = new Date("2026-08-15T12:00:00.000Z");

function periodsRequest(
  chatId: number,
  authorization: string | null = signedTmaAuthorization(REGISTERED_PERSONA_ID),
): Request {
  return new Request(
    `http://localhost/api/leaderboard/periods?chat_id=${String(chatId)}`,
    { headers: authorization ? { authorization } : {} },
  );
}

describe("GET /api/leaderboard/periods", () => {
  beforeEach(() => {
    process.env.BOT_TOKEN = TEST_BOT_TOKEN;
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    delete process.env.BOT_TOKEN;
    await resetRuntimeDbForTests();
  });

  it("refuses a Chat the Member has no Registration in", async () => {
    const db = await getRuntimeDb();
    await resetAndSeedDatabase(db, FIXTURE_NOW);

    const response = await GET(periodsRequest(SECONDARY_FIXTURE_CHAT_ID));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("returns 400 without a Chat", async () => {
    const response = await GET(
      new Request("http://localhost/api/leaderboard/periods", {
        headers: {
          authorization: signedTmaAuthorization(REGISTERED_PERSONA_ID),
        },
      }),
    );

    expect(response.status).toBe(400);
  });

  it("lists only the Seasons that hold Events for that Chat", async () => {
    const db = await getRuntimeDb();
    await resetAndSeedDatabase(db, FIXTURE_NOW);

    const response = await GET(periodsRequest(PRIMARY_FIXTURE_CHAT_ID));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      seasons: [
        { year: 2026, month: 7 },
        { year: 2026, month: 8 },
      ],
    });
  });
});
