import { emitEvent, isTMA, mockTelegramEnv } from "@tma.js/sdk-react";

const THEME_PARAMS = {
  accent_text_color: "#6ab2f2",
  bg_color: "#17212b",
  button_color: "#5288c1",
  button_text_color: "#ffffff",
  destructive_text_color: "#ec3942",
  header_bg_color: "#17212b",
  hint_color: "#708499",
  link_color: "#6ab3f3",
  secondary_bg_color: "#232e3c",
  section_bg_color: "#17212b",
  section_header_text_color: "#6ab3f3",
  subtitle_text_color: "#708499",
  text_color: "#f5f5f5",
} as const;

const NO_INSETS = { left: 0, top: 0, bottom: 0, right: 0 } as const;

export async function mockDevelopmentTmaEnvironment(
  initDataRaw: string | null | undefined,
): Promise<void> {
  if (await isTMA("complete")) {
    return;
  }

  if (!initDataRaw) {
    throw new Error("Development TMA init data is unavailable");
  }

  mockTelegramEnv({
    resetPostMessage: true,
    launchParams: new URLSearchParams([
      ["tgWebAppThemeParams", JSON.stringify(THEME_PARAMS)],
      ["tgWebAppData", initDataRaw],
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
          emitEvent("safe_area_changed", NO_INSETS);
          return;
        case "web_app_request_content_safe_area":
          emitEvent("content_safe_area_changed", NO_INSETS);
          return;
        default:
          next();
      }
    },
  });
}
