"use client";

import {
  backButton,
  hapticFeedback,
  init,
  initData,
  isTMA,
  miniApp,
  swipeBehavior,
  themeParams,
  viewport,
} from "@tma.js/sdk-react";
import { z } from "zod";

const ARCADE_CHROME_COLOR = "#100c18";
const doNothing = () => undefined;

export interface TelegramPlatform {
  initDataRaw: string;
  memberId: number;
  supportsNativeBackButton: boolean;
  impact: VoidFunction;
  selection: VoidFunction;
  notificationSuccess: VoidFunction;
  ready: VoidFunction;
  setBackButton: (visible: boolean, onBack: VoidFunction) => VoidFunction;
}

export type MiniAppLaunch =
  | { kind: "telegram"; platform: TelegramPlatform }
  | { kind: "outside-telegram" }
  | { kind: "initialization-error" };

const developmentResponseSchema = z.object({ initDataRaw: z.string().min(1) });
const initUserSchema = z.object({ id: z.number().int() });

async function developmentInitData(): Promise<string | undefined> {
  if (process.env.NODE_ENV === "production") return undefined;

  const persona = new URL(window.location.href).searchParams.get("persona");
  const params = new URLSearchParams();
  if (persona) params.set("persona", persona);
  const response = await fetch(`/api/development/init-data?${params}`);
  if (!response.ok) return undefined;
  return developmentResponseSchema.parse(await response.json()).initDataRaw;
}

function memberIdFromRaw(raw: string): number {
  const user = new URLSearchParams(raw).get("user");
  return initUserSchema.parse(JSON.parse(user ?? "null")).id;
}

function mountMiniAppChrome(): void {
  const mounted = miniApp.mount.ifAvailable();
  if (!mounted.ok) return;
  miniApp.setHeaderColor.ifAvailable(ARCADE_CHROME_COLOR);
  miniApp.setBottomBarColor.ifAvailable(ARCADE_CHROME_COLOR);
}

/**
 * Binds the viewport's CSS variables and expands the Mini App — when the client
 * gets around to it.
 *
 * Deliberately not awaited. Mounting the viewport asks Telegram for the safe
 * area insets, and Telegram Desktop reports Bot API 8.0 support while never
 * answering `web_app_request_safe_area`; the SDK's mount has no timeout, so the
 * promise stays pending for the whole session. Blocking the launch on it left
 * Desktop on the loading screen forever with nothing to report. Every variable
 * bound here has a fallback in `arcade.css`, so the app is correct whether this
 * resolves late or never.
 */
function mountViewport(): void {
  const mounted = viewport.mount.ifAvailable();
  if (!mounted.ok) return;
  void mounted.data.then(
    () => {
      if (!viewport.isCssVarsBound()) viewport.bindCssVars.ifAvailable();
      viewport.expand.ifAvailable();
    },
    () => undefined,
  );
}

async function launchTelegramPlatform(): Promise<MiniAppLaunch> {
  try {
    if (process.env.NODE_ENV !== "production" && !(await isTMA("complete"))) {
      const raw = await developmentInitData();
      if (!raw) return { kind: "initialization-error" };
      const { mockDevelopmentTmaEnvironment } =
        await import("../tma-development");
      await mockDevelopmentTmaEnvironment(raw);
    }

    if (!(await isTMA("complete"))) return { kind: "outside-telegram" };
    init();
    initData.restore();
    const initDataRaw = initData.raw();
    if (!initDataRaw) return { kind: "initialization-error" };

    themeParams.mount.ifAvailable();
    themeParams.bindCssVars.ifAvailable();
    mountMiniAppChrome();
    swipeBehavior.mount.ifAvailable();
    swipeBehavior.disableVertical.ifAvailable();
    const backMounted = backButton.mount.ifAvailable();
    mountViewport();

    let ready = false;
    return {
      kind: "telegram",
      platform: {
        initDataRaw,
        memberId: memberIdFromRaw(initDataRaw),
        supportsNativeBackButton: backMounted.ok,
        impact() {
          hapticFeedback.impactOccurred.ifAvailable("medium");
        },
        selection() {
          hapticFeedback.selectionChanged.ifAvailable();
        },
        notificationSuccess() {
          hapticFeedback.notificationOccurred.ifAvailable("success");
        },
        ready() {
          if (!ready) {
            miniApp.ready.ifAvailable();
            ready = true;
          }
        },
        setBackButton(visible, onBack) {
          if (!backMounted.ok) return doNothing;
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
      },
    };
  } catch {
    return { kind: "initialization-error" };
  }
}

let platformPromise: Promise<MiniAppLaunch> | undefined;

export function initializeTelegramPlatform(): Promise<MiniAppLaunch> {
  platformPromise ??= launchTelegramPlatform();
  return platformPromise;
}
