import { describe, expect, it } from "vitest";

import { parseDatabaseUrl, parseServerEnv } from "./env";

describe("parseServerEnv", () => {
  it("parses required server env vars", () => {
    const env = parseServerEnv({
      BOT_TOKEN: "123:ABC",
      BOT_WEBHOOK_SECRET: "secret",
      DATABASE_URL: "postgres://user:pass@localhost:5432/mike",
    });

    expect(env.BOT_TOKEN).toBe("123:ABC");
    expect(env.BOT_WEBHOOK_SECRET).toBe("secret");
    expect(env.DATABASE_URL).toBe("postgres://user:pass@localhost:5432/mike");
  });

  it("throws when a required var is missing", () => {
    expect(() =>
      parseServerEnv({
        BOT_TOKEN: "123:ABC",
        BOT_WEBHOOK_SECRET: "secret",
      }),
    ).toThrow();
  });

  it("parses DATABASE_URL independently for runtime database selection", () => {
    expect(
      parseDatabaseUrl({ DATABASE_URL: "postgres://localhost/mike" }),
    ).toBe("postgres://localhost/mike");
    expect(() => parseDatabaseUrl({})).toThrow();
  });

  it.each(["contains spaces", "bad!character", "a".repeat(257)])(
    "rejects an invalid webhook secret: %s",
    (secret) => {
      expect(() =>
        parseServerEnv({
          BOT_TOKEN: "123:ABC",
          BOT_WEBHOOK_SECRET: secret,
          DATABASE_URL: "postgres://localhost/mike",
        }),
      ).toThrow(/BOT_WEBHOOK_SECRET/);
    },
  );
});
