"use client";

import {
  backButton,
  hapticFeedback,
  init,
  isTMA,
  miniApp,
  swipeBehavior,
  viewport,
} from "@tma.js/sdk-react";

/** The near-black at the root of the prototype's committed arcade palette. */
const ARCADE_CHROME_COLOR = "#100c18";
const DEVELOPMENT_INIT_DATA = new URLSearchParams({
  auth_date: "1787227200",
  hash: "0".repeat(64),
  signature: "",
  user: JSON.stringify({
    id: 104,
    first_name: "Prototype",
    is_bot: false,
    username: "v2_ui_prototype",
  }),
}).toString();

export interface TelegramPlatform {
  impact: VoidFunction;
  selection: VoidFunction;
  notificationSuccess: VoidFunction;
  setBackButton: (visible: boolean, onBack: VoidFunction) => VoidFunction;
}

const doNothing = () => undefined;

export const WEB_TELEGRAM_PLATFORM: TelegramPlatform = {
  impact: doNothing,
  selection: doNothing,
  notificationSuccess: doNothing,
  setBackButton: () => doNothing,
};

let platformPromise: Promise<TelegramPlatform> | undefined;

function mountMiniAppChrome(): void {
  const mounted = miniApp.mount.ifAvailable();
  if (!mounted.ok) return;

  miniApp.setHeaderColor.ifAvailable(ARCADE_CHROME_COLOR);
  miniApp.setBottomBarColor.ifAvailable(ARCADE_CHROME_COLOR);
}

async function mountViewport(): Promise<void> {
  const mounted = viewport.mount.ifAvailable();
  if (!mounted.ok) return;

  try {
    await mounted.data;
  } catch {
    // A failed Telegram request must not stop the prototype working on the web.
    return;
  }

  if (!viewport.isCssVarsBound()) {
    viewport.bindCssVars.ifAvailable();
  }
  viewport.expand.ifAvailable();
}

function disableVerticalDismissal(): void {
  const mounted = swipeBehavior.mount.ifAvailable();
  if (!mounted.ok) return;

  swipeBehavior.disableVertical.ifAvailable();
}

function mountBackButton(): void {
  backButton.mount.ifAvailable();
}

function createTelegramPlatform(): TelegramPlatform {
  return {
    impact() {
      hapticFeedback.impactOccurred.ifAvailable("medium");
    },
    selection() {
      hapticFeedback.selectionChanged.ifAvailable();
    },
    notificationSuccess() {
      hapticFeedback.notificationOccurred.ifAvailable("success");
    },
    setBackButton(visible, onBack) {
      if (!visible) {
        backButton.hide.ifAvailable();
        return doNothing;
      }

      const listener = backButton.onClick.ifAvailable(onBack);
      if (!listener.ok) return doNothing;

      backButton.show.ifAvailable();

      return () => {
        listener.data();
        backButton.hide.ifAvailable();
      };
    },
  };
}

async function launchTelegramPlatform(): Promise<TelegramPlatform> {
  try {
    if (process.env.NODE_ENV !== "production") {
      const { mockDevelopmentTmaEnvironment } =
        await import("@/app/(root)/tma-development");
      await mockDevelopmentTmaEnvironment(DEVELOPMENT_INIT_DATA);
    }

    if (!(await isTMA("complete"))) return WEB_TELEGRAM_PLATFORM;

    init();
  } catch {
    return WEB_TELEGRAM_PLATFORM;
  }

  mountMiniAppChrome();
  disableVerticalDismissal();
  mountBackButton();
  await mountViewport();

  return createTelegramPlatform();
}

/**
 * Starts the Telegram shell once per Mini App launch.
 *
 * The production Mini App's development environment mock is reused verbatim so
 * a normal local browser exercises the same viewport and safe-area events as
 * production. In a real non-Telegram page every method resolves to a no-op.
 */
export function initializeTelegramPlatform(): Promise<TelegramPlatform> {
  platformPromise ??= launchTelegramPlatform();
  return platformPromise;
}
