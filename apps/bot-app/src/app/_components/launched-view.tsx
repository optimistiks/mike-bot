import type { ReactElement } from "react";

import type { MiniAppLaunch } from "@/app/_lib/telegram-platform";

import { FailedView } from "@/app/_components/failed-view";
import { VerifiedOpener } from "@/app/_components/verified-opener";

function LaunchedView({ launch }: { launch: MiniAppLaunch }): ReactElement {
  if (launch.kind === "telegram") {
    return <VerifiedOpener initDataRaw={launch.platform.initDataRaw} />;
  }
  return <FailedView kind={launch.kind} />;
}

export { LaunchedView };
