import { afterEach, describe, expect, it, vi } from "vitest";

import { events } from "./schema";
import { getRuntimeDb, resetRuntimeDbForTests } from "./runtime";

describe("getRuntimeDb", () => {
  afterEach(async () => {
    vi.unstubAllEnvs();
    await resetRuntimeDbForTests();
  });

  it("always uses isolated PGlite in tests when DATABASE_URL is present", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://production.invalid/mike");

    const db = await getRuntimeDb();

    await expect(db.select().from(events)).resolves.toEqual([]);
  });

  it("fails clearly when production has no DATABASE_URL", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "");

    await expect(getRuntimeDb()).rejects.toThrow(/DATABASE_URL/);
  });
});
