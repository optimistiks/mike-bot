import { describe, expect, it } from "vitest";

import {
  FORBIDDEN_PERSONA_ID,
  REGISTERED_PERSONA_ID,
  UNREGISTERED_PERSONA_ID,
} from "@/lib/db/seed-personas";

import { authenticateTmaMember } from "./init-data";
import { signDevelopmentInitDataForPersona } from "./development-init-data.server";
import { TEST_DEVELOPMENT_BOT_TOKEN } from "@/test/tma-init-data";

const DEVELOPMENT_ENV = {
  TMA_DEVELOPMENT_BOT_TOKEN: TEST_DEVELOPMENT_BOT_TOKEN,
};

describe("development TMA init data", () => {
  it.each([
    ["registered", REGISTERED_PERSONA_ID],
    ["unregistered", UNREGISTERED_PERSONA_ID],
    ["forbidden", FORBIDDEN_PERSONA_ID],
  ] as const)("signs the seeded %s persona", (persona, userId) => {
    const initDataRaw = signDevelopmentInitDataForPersona(persona, {
      env: DEVELOPMENT_ENV,
    });

    expect(initDataRaw).not.toBeNull();
    expect(
      authenticateTmaMember(
        `tma ${String(initDataRaw)}`,
        TEST_DEVELOPMENT_BOT_TOKEN,
      ),
    ).toEqual({ userId });
  });

  it("does not sign an arbitrary identity", () => {
    expect(
      signDevelopmentInitDataForPersona("member_999", {
        env: DEVELOPMENT_ENV,
      }),
    ).toBeNull();
  });

  it("requires the development bot token from the environment", () => {
    expect(() =>
      signDevelopmentInitDataForPersona("registered", { env: {} }),
    ).toThrow();
  });
});
