"use client";

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

const NO_INSETS = { bottom: 0, left: 0, right: 0, top: 0 } as const;

function emitTheme(): void {
  emitEvent("theme_changed", { theme_params: THEME_PARAMS });
}

function emitViewport(): void {
  emitEvent("viewport_changed", {
    height: window.innerHeight,
    is_expanded: true,
    is_state_stable: true,
    width: window.innerWidth,
  });
}

function emitSafeArea(): void {
  emitEvent("safe_area_changed", NO_INSETS);
}

function emitContentSafeArea(): void {
  emitEvent("content_safe_area_changed", NO_INSETS);
}

const MOCK_EVENTS: Record<string, () => void> = {
  web_app_request_content_safe_area: emitContentSafeArea,
  web_app_request_safe_area: emitSafeArea,
  web_app_request_theme: emitTheme,
  web_app_request_viewport: emitViewport,
};

function handleMockEvent(name: string, next: () => void): void {
  const handler = MOCK_EVENTS[name];
  if (handler === undefined) {
    next();
    return;
  }
  handler();
}

async function mockDevelopmentTmaEnvironment(initDataRaw: string): Promise<void> {
  if (await isTMA("complete")) {
    return;
  }

  mockTelegramEnv({
    launchParams: {
      tgWebAppData: initDataRaw,
      tgWebAppPlatform: "tdesktop",
      tgWebAppThemeParams: THEME_PARAMS,
      tgWebAppVersion: "8.4",
    },
    onEvent(event, next) {
      handleMockEvent(event.name, next);
    },
    resetPostMessage: true,
  });
}

export { mockDevelopmentTmaEnvironment };
