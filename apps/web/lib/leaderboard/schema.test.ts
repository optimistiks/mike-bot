import { describe, expect, it } from "vitest";

import { leaderboardQuerySchema } from "./schema";

describe("leaderboardQuerySchema", () => {
  it("accepts chat_id with optional year and month", () => {
    const parsed = leaderboardQuerySchema.parse({
      chat_id: "-100456789",
      year: "2026",
      month: "8",
    });

    expect(parsed).toEqual({
      chatId: -100_456_789,
      year: 2026,
      month: 8,
    });
  });

  it("accepts a year without a month for annual totals", () => {
    const parsed = leaderboardQuerySchema.parse({
      chat_id: "1",
      year: "2026",
    });

    expect(parsed).toEqual({ chatId: 1, year: 2026, month: undefined });
  });

  it("rejects a month without a year", () => {
    expect(
      leaderboardQuerySchema.safeParse({ chat_id: "1", month: "8" }).success,
    ).toBe(false);
  });

  it("does not accept the internal chatId spelling at the HTTP boundary", () => {
    expect(
      leaderboardQuerySchema.safeParse({ chatId: "-100456789" }).success,
    ).toBe(false);
  });
});
