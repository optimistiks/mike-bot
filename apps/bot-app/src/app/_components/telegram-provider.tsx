"use client";

import type { ReactElement, ReactNode } from "react";

import { use, useEffect } from "react";

import type { MiniAppLaunch } from "@/app/_lib/telegram-platform";

import { TelegramLaunchContext } from "@/app/_lib/telegram-launch-context";
import { initializeTelegramPlatform } from "@/app/_lib/telegram-platform";

function callReady(launch: MiniAppLaunch): void {
  if (launch.kind === "telegram") {
    launch.platform.ready();
  }
}

function TelegramProvider({
  children,
  isProduction,
}: {
  children: ReactNode;
  isProduction: boolean;
}): ReactElement {
  const launch = use(initializeTelegramPlatform(isProduction));

  useEffect((): void => {
    callReady(launch);
  }, [launch]);

  return <TelegramLaunchContext value={launch}>{children}</TelegramLaunchContext>;
}

export { TelegramProvider };
