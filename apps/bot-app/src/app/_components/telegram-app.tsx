"use client";

import type { ReactElement } from "react";

import { OpenerPage } from "@/app/_components/opener-page";
import { TelegramProvider } from "@/app/_components/telegram-provider";

function TelegramApp({ isProduction }: { isProduction: boolean }): ReactElement {
  return (
    <TelegramProvider isProduction={isProduction}>
      <OpenerPage />
    </TelegramProvider>
  );
}

export default TelegramApp;
