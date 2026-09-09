"use client";

import type { ReactElement } from "react";

import { use, useEffect } from "react";

import type { MiniAppLaunch } from "@/app/_lib/telegram-platform";

import { FailedView } from "@/app/_components/failed-view";
import { VerifiedOpener } from "@/app/_components/verified-opener";
import { initializeTelegramPlatform } from "@/app/_lib/telegram-platform";

function callReady(launch: MiniAppLaunch): void {
  if (launch.kind === "telegram") {
    launch.platform.ready();
  }
}

function TelegramApp({ isProduction }: { isProduction: boolean }): ReactElement {
  const launch = use(initializeTelegramPlatform(isProduction));

  useEffect((): void => {
    callReady(launch);
  }, [launch]);

  if (launch.kind === "telegram") {
    return <VerifiedOpener initDataRaw={launch.platform.initDataRaw} />;
  }
  return <FailedView kind={launch.kind} />;
}

export default TelegramApp;
