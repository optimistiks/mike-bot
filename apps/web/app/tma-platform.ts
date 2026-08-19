import {
  backButton,
  init,
  initData,
  isTMA,
  miniApp,
  themeParams,
  viewport,
} from "@tma.js/sdk-react";

export interface MiniAppPlatform {
  initDataRaw: string;
  supportsNativeBackButton: boolean;
  ready(): void;
  setBackButton(visible: boolean, onBack: VoidFunction): VoidFunction;
}

export type MiniAppLaunch =
  | { kind: "telegram"; platform: MiniAppPlatform }
  | { kind: "outside-telegram" }
  | { kind: "initialization-error" };

export type LaunchMiniApp = () => Promise<MiniAppLaunch>;

let launchPromise: Promise<MiniAppLaunch> | undefined;

async function launchTma(): Promise<MiniAppLaunch> {
  let isTelegramMiniApp = false;

  try {
    isTelegramMiniApp = await isTMA("complete");
  } catch {
    return { kind: "initialization-error" };
  }

  if (!isTelegramMiniApp) {
    return { kind: "outside-telegram" };
  }

  try {
    init();

    const supportsNativeBackButton = backButton.mount.isAvailable();
    if (supportsNativeBackButton) {
      backButton.mount();
    }

    initData.restore();
    const initDataRaw = initData.raw();
    if (!initDataRaw) {
      return { kind: "initialization-error" };
    }

    if (themeParams.mount.isAvailable()) {
      themeParams.mount();
      themeParams.bindCssVars.ifAvailable();
    }

    if (miniApp.mount.isAvailable()) {
      miniApp.mount();
      miniApp.bindCssVars.ifAvailable();
    }

    if (viewport.mount.isAvailable()) {
      await viewport.mount();
      viewport.bindCssVars.ifAvailable();
      viewport.expand.ifAvailable();
    }

    let isReady = false;

    return {
      kind: "telegram",
      platform: {
        initDataRaw,
        supportsNativeBackButton,
        ready() {
          if (!isReady) {
            miniApp.ready.ifAvailable();
            isReady = true;
          }
        },
        setBackButton(visible, onBack) {
          if (!supportsNativeBackButton) {
            return () => undefined;
          }

          if (!visible) {
            backButton.hide.ifAvailable();
            return () => undefined;
          }

          const removeListener = backButton.onClick(onBack);
          backButton.show();

          return () => {
            removeListener();
            backButton.hide.ifAvailable();
          };
        },
      },
    };
  } catch {
    return { kind: "initialization-error" };
  }
}

export function initializeTmaPlatform(): Promise<MiniAppLaunch> {
  launchPromise ??= launchTma();
  return launchPromise;
}
