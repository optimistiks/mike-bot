"use client";

import type { ReactElement } from "react";

import dynamic from "next/dynamic";

import { LoadingStatus } from "@/app/_components/loading-status";

const TelegramApp = dynamic(() => import("@/app/_components/telegram-app"), {
  loading: LoadingStatus,
  ssr: false,
});

function HomeClient({ isProduction }: { isProduction: boolean }): ReactElement {
  return <TelegramApp isProduction={isProduction} />;
}

export { HomeClient };
