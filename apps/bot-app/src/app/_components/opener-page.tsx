"use client";

import type { ReactElement } from "react";

import { OpenerView } from "@/app/_components/opener-view";
import { useTelegramLaunch } from "@/app/_lib/telegram-launch-context";

function OpenerPage(): ReactElement {
  const launch = useTelegramLaunch();
  return <OpenerView launch={launch} />;
}

export { OpenerPage };
