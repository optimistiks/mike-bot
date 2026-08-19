import { afterEach, describe, expect, it } from "vitest";

import { getRuntimeDb, resetRuntimeDbForTests } from "@/lib/db/runtime";
import { chatMembers, chatMemberships, events } from "@/lib/db/schema";

import { GET } from "./route";

describe("GET /api/leaderboard", () => {
  afterEach(async () => {
    await resetRuntimeDbForTests();
  });

  it("does not create fixture rows while reading a leaderboard", async () => {
    const db = await getRuntimeDb();
    const response = await GET(
      new Request(
        "http://localhost/api/leaderboard?chatId=-100111222&year=2026&month=8",
      ),
    );

    expect(response.status).toBe(200);
    await expect(db.select().from(events)).resolves.toEqual([]);
    await expect(db.select().from(chatMembers)).resolves.toEqual([]);
    await expect(db.select().from(chatMemberships)).resolves.toEqual([]);
  });
});
