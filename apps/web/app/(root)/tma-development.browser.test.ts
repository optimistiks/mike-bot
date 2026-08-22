import { expect } from "vitest";

import { test } from "@/test/browser/msw";

import { mockDevelopmentTmaEnvironment } from "./tma-development";
import { initializeTelegramPlatform } from "./_lib/telegram-platform";

const RAW_INIT_DATA = new URLSearchParams({
  auth_date: "1787227200",
  hash: "0".repeat(64),
  signature: "",
  user: JSON.stringify({
    id: 104,
    first_name: "Unregistered",
    is_bot: false,
    username: "unregistered",
  }),
}).toString();

test("mocks a complete TMA launch from server-provided init data", async () => {
  await mockDevelopmentTmaEnvironment(RAW_INIT_DATA);
  const launch = await initializeTelegramPlatform();

  expect(launch).toMatchObject({
    kind: "telegram",
    platform: { initDataRaw: RAW_INIT_DATA },
  });
  expect(
    document.documentElement.style.getPropertyValue("--tg-theme-bg-color"),
  ).toBe("#17212b");
  expect(
    document.documentElement.style.getPropertyValue("--tg-viewport-height"),
  ).toMatch(/px$/);
  expect(
    document.documentElement.style.getPropertyValue(
      "--tg-viewport-safe-area-inset-top",
    ),
  ).toBe("0px");
  expect(
    document.documentElement.style.getPropertyValue(
      "--tg-viewport-content-safe-area-inset-bottom",
    ),
  ).toBe("0px");
});
