"use client";

import { createContext, use } from "react";

import type { MiniAppLaunch } from "@/app/_lib/telegram-platform";

const TelegramLaunchContext = createContext<MiniAppLaunch | null>(null);

function useTelegramLaunch(): MiniAppLaunch | null {
  return use(TelegramLaunchContext);
}

export { TelegramLaunchContext, useTelegramLaunch };
