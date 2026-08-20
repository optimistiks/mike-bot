import { afterEach, describe, expect, it, vi } from "vitest";

import { REGISTERED_PERSONA_ID } from "@/lib/db/seed-personas";
import {
  TEST_BOT_TOKEN,
  TEST_DEVELOPMENT_BOT_TOKEN,
} from "@/test/tma-init-data";

import { signDevelopmentInitDataForPersona } from "./development-init-data.server";
import { authenticateTmaRequestMember } from "./request-auth.server";

describe("request TMA authentication", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts the environment-configured development signer only in development", async () => {
    const initDataRaw = signDevelopmentInitDataForPersona("registered", {
      env: { TMA_DEVELOPMENT_BOT_TOKEN: TEST_DEVELOPMENT_BOT_TOKEN },
    });
    const authorization = `tma ${String(initDataRaw)}`;

    vi.stubEnv("TMA_DEVELOPMENT_BOT_TOKEN", TEST_DEVELOPMENT_BOT_TOKEN);
    await expect(authenticateTmaRequestMember(authorization)).resolves.toEqual({
      userId: REGISTERED_PERSONA_ID,
    });

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BOT_TOKEN", TEST_BOT_TOKEN);
    await expect(
      authenticateTmaRequestMember(authorization),
    ).resolves.toBeNull();
  });
});
