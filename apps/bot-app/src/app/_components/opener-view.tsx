import type { ReactElement } from "react";

import type { MiniAppLaunch } from "@/app/_lib/telegram-platform";

import { LaunchedView } from "@/app/_components/launched-view";
import { LOADING } from "@/app/_components/opener-copy";
import { Status } from "@/app/_components/status";

function OpenerView({ launch }: { launch: MiniAppLaunch | null }): ReactElement {
  if (launch === null) {
    return <Status text={LOADING} />;
  }
  return <LaunchedView launch={launch} />;
}

export { OpenerView };
