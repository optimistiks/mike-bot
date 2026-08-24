import { emitEvent, mockTelegramEnv } from "@tma.js/sdk-react";
import { expect } from "vitest";

import { test } from "@/test/browser/msw";

import { initializeTelegramPlatform } from "./telegram-platform";

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

const THEME_PARAMS = { bg_color: "#17212b", text_color: "#f5f5f5" } as const;

/**
 * Telegram Desktop as it actually behaves: it reports Bot API 8.4 and answers
 * the theme and viewport requests, but never the safe area ones.
 */
function mockDesktopWithoutSafeArea(): void {
  mockTelegramEnv({
    resetPostMessage: true,
    launchParams: new URLSearchParams([
      ["tgWebAppThemeParams", JSON.stringify(THEME_PARAMS)],
      ["tgWebAppData", RAW_INIT_DATA],
      ["tgWebAppVersion", "8.4"],
      ["tgWebAppPlatform", "tdesktop"],
    ]),
    onEvent(event, next) {
      switch (event.name) {
        case "web_app_request_theme":
          emitEvent("theme_changed", { theme_params: THEME_PARAMS });
          return;
        case "web_app_request_viewport":
          emitEvent("viewport_changed", {
            height: window.innerHeight,
            width: window.innerWidth,
            is_expanded: true,
            is_state_stable: true,
          });
          return;
        case "web_app_request_safe_area":
        case "web_app_request_content_safe_area":
          return;
        default:
          next();
      }
    },
  });
}

/**
 * The viewport's mount waits on the safe area request, and the SDK gives it no
 * timeout, so on Desktop that promise stays pending for the whole session. The
 * launch must not be the thing waiting on it, or the Mini App sits on its
 * loading screen forever with nothing to report.
 */
test("launches when the client never answers the safe area request", async () => {
  mockDesktopWithoutSafeArea();

  await expect(initializeTelegramPlatform()).resolves.toMatchObject({
    kind: "telegram",
    platform: { initDataRaw: RAW_INIT_DATA },
  });
});
