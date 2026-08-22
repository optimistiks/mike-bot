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

async function mountViewport(): Promise<void> {
  const mounted = viewport.mount.ifAvailable();
  if (!mounted.ok) return;
  try {
    await mounted.data;
  } catch {
    return;
  }
  if (!viewport.isCssVarsBound()) viewport.bindCssVars.ifAvailable();
  viewport.expand.ifAvailable();
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
    await mountViewport();

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
