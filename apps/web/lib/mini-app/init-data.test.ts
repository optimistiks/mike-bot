import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { signedTmaAuthorization, TEST_BOT_TOKEN } from "@/test/tma-init-data";

import { authenticateTmaMember } from "./init-data";

describe("authenticateTmaMember", () => {
  const now = new Date("2026-08-20T12:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("trusts a Member only after validating signed init data", () => {
    expect(
      authenticateTmaMember(signedTmaAuthorization(12345, now), TEST_BOT_TOKEN),
    ).toEqual({ userId: 12345 });

    expect(
      authenticateTmaMember(
        signedTmaAuthorization(12345, now, "987654321:WRONG_TOKEN"),
        TEST_BOT_TOKEN,
      ),
    ).toBeNull();
  });

  it("enforces the 365-day lifetime", () => {
    const exactlyOneYearOld = new Date(
      now.getTime() - 365 * 24 * 60 * 60 * 1_000,
    );
    const tooOld = new Date(exactlyOneYearOld.getTime() - 1_000);

    expect(
      authenticateTmaMember(
        signedTmaAuthorization(12345, exactlyOneYearOld),
        TEST_BOT_TOKEN,
      ),
    ).toEqual({ userId: 12345 });
    expect(
      authenticateTmaMember(
        signedTmaAuthorization(12345, tooOld),
        TEST_BOT_TOKEN,
      ),
    ).toBeNull();
  });

  it("allows ordinary future clock skew but rejects larger jumps", () => {
    const withinSkew = new Date(now.getTime() + 60_000);
    const beyondSkew = new Date(now.getTime() + 61_000);

    expect(
      authenticateTmaMember(
        signedTmaAuthorization(12345, withinSkew),
        TEST_BOT_TOKEN,
      ),
    ).toEqual({ userId: 12345 });
    expect(
      authenticateTmaMember(
        signedTmaAuthorization(12345, beyondSkew),
        TEST_BOT_TOKEN,
      ),
    ).toBeNull();
  });

  it("rejects missing and malformed authorization", () => {
    expect(authenticateTmaMember(null, TEST_BOT_TOKEN)).toBeNull();
    expect(authenticateTmaMember("Bearer token", TEST_BOT_TOKEN)).toBeNull();
    expect(
      authenticateTmaMember("tma not-init-data", TEST_BOT_TOKEN),
    ).toBeNull();
  });
});
