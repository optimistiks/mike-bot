"use client";

import {
  backButton,
  init,
  initData,
  isTMA,
  miniApp,
  retrieveRawInitData,
  swipeBehavior,
  themeParams,
  viewport,
} from "@tma.js/sdk-react";

import { isRecord, nonemptyString } from "@/tma/record";

interface TelegramPlatform {
  initDataRaw: string;
  ready: VoidFunction;
}

type MiniAppLaunch =
  | { kind: "telegram"; platform: TelegramPlatform }
  | { kind: "outside-telegram" }
  | { kind: "initialization-error" };

const retainedTasks: Promise<void>[] = [];
let platformPromise: Promise<MiniAppLaunch> | null = null;

function retainPromise(task: Promise<void>): void {
  retainedTasks.push(task);
}

function initDataRawFromUnknown(data: unknown): string | undefined {
  if (!isRecord(data)) {
    return undefined;
  }
  return nonemptyString(data.initDataRaw);
}

async function fetchDevelopmentInitData(): Promise<string> {
  const response = await fetch("/api/development/init-data");
  const initDataRaw = initDataRawFromUnknown(await response.json());
  if (response.ok && initDataRaw !== undefined) {
    return initDataRaw;
  }
  throw new Error("Development TMA init data is unavailable");
}

async function mockDevelopmentEnvironment(): Promise<void> {
  const raw = await fetchDevelopmentInitData();
  const { mockDevelopmentTmaEnvironment } = await import("@/app/_lib/mock-telegram-env");
  await mockDevelopmentTmaEnvironment(raw);
}

async function maybeMockDevelopmentEnvironment(isProduction: boolean): Promise<void> {
  if (isProduction) {
    return;
  }
  if (await isTMA("complete")) {
    return;
  }
  await mockDevelopmentEnvironment();
}

function readRawInitData(): string | undefined {
  try {
    return retrieveRawInitData();
  } catch {
    return undefined;
  }
}

function mountTheme(): void {
  if (themeParams.mount.isAvailable()) {
    themeParams.mount();
  }
  if (themeParams.bindCssVars.isAvailable()) {
    themeParams.bindCssVars();
  }
}

function mountMiniApp(): void {
  if (miniApp.mount.isAvailable()) {
    miniApp.mount();
  }
}

function mountSwipe(): void {
  if (swipeBehavior.mount.isAvailable()) {
    swipeBehavior.mount();
  }
  if (swipeBehavior.disableVertical.isAvailable()) {
    swipeBehavior.disableVertical();
  }
}

function mountBackButton(): void {
  if (backButton.mount.isAvailable()) {
    backButton.mount();
  }
}

function ignoreViewportFailure(): undefined {
  return undefined;
}

function onViewportMounted(): void {
  if (viewport.bindCssVars.isAvailable()) {
    viewport.bindCssVars();
  }
  if (viewport.expand.isAvailable()) {
    viewport.expand();
  }
}

function mountViewport(): void {
  if (!viewport.mount.isAvailable()) {
    return;
  }

  async function mountAndBind(): Promise<void> {
    try {
      await viewport.mount();
      onViewportMounted();
    } catch {
      ignoreViewportFailure();
    }
  }

  retainPromise(mountAndBind());
}

function mountTelegramChrome(): void {
  mountTheme();
  mountMiniApp();
  mountSwipe();
  mountBackButton();
  mountViewport();
}

function markReadyOnce(done: boolean, mark: VoidFunction): void {
  if (done) {
    return;
  }
  mark();
  miniApp.ready.ifAvailable();
}

function createReady(): VoidFunction {
  let done = false;
  return () => {
    markReadyOnce(done, () => {
      done = true;
    });
  };
}

function telegramLaunch(initDataRaw: string): MiniAppLaunch {
  return {
    kind: "telegram",
    platform: {
      initDataRaw,
      ready: createReady(),
    },
  };
}

function bootTelegramPlatform(): MiniAppLaunch {
  init();
  initData.restore();
  const initDataRaw = readRawInitData();
  if (initDataRaw === undefined) {
    return { kind: "initialization-error" };
  }
  mountTelegramChrome();
  return telegramLaunch(initDataRaw);
}

async function launchTelegramPlatformUnsafe(isProduction: boolean): Promise<MiniAppLaunch> {
  await maybeMockDevelopmentEnvironment(isProduction);
  if (!(await isTMA("complete"))) {
    return { kind: "outside-telegram" };
  }
  return bootTelegramPlatform();
}

async function launchTelegramPlatform(isProduction: boolean): Promise<MiniAppLaunch> {
  try {
    return await launchTelegramPlatformUnsafe(isProduction);
  } catch {
    return { kind: "initialization-error" };
  }
}

function initializeTelegramPlatform(isProduction: boolean): Promise<MiniAppLaunch> {
  platformPromise ??= launchTelegramPlatform(isProduction);
  return platformPromise;
}

export { initializeTelegramPlatform, type MiniAppLaunch };
