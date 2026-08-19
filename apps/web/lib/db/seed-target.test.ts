import path from "node:path";

import { describe, expect, it } from "vitest";

import { resolveDatabaseSeedTarget } from "./seed-target";

describe("resolveDatabaseSeedTarget", () => {
  const cwd = "/workspace/apps/web";

  it("selects the shared file-backed PGlite database by default", () => {
    expect(resolveDatabaseSeedTarget([], {}, cwd)).toEqual({
      kind: "pglite",
      dataDir: path.resolve(cwd, ".data/pglite"),
    });
  });

  it("uses an explicitly configured local PGlite directory", () => {
    expect(
      resolveDatabaseSeedTarget(
        [],
        { PGLITE_DATA_DIR: "./tmp/custom-pglite" },
        cwd,
      ),
    ).toEqual({
      kind: "pglite",
      dataDir: path.resolve(cwd, "tmp/custom-pglite"),
    });
  });

  it("refuses a remote target without explicit destructive opt-in", () => {
    expect(() =>
      resolveDatabaseSeedTarget(
        ["--remote"],
        { DATABASE_URL: "postgres://pooled.example/mike" },
        cwd,
      ),
    ).toThrow("ALLOW_REMOTE_DATABASE_SEED=1");
  });

  it("selects the direct remote URL after explicit opt-in", () => {
    expect(
      resolveDatabaseSeedTarget(
        ["--remote"],
        {
          ALLOW_REMOTE_DATABASE_SEED: "1",
          DATABASE_URL: "postgres://pooled.example/mike",
          DATABASE_URL_UNPOOLED: "postgres://direct.example/mike",
        },
        cwd,
      ),
    ).toEqual({
      kind: "postgres",
      databaseUrl: "postgres://direct.example/mike",
    });
  });
});
