import type { ReactElement } from "react";

import { OUTSIDE_TELEGRAM, START_FAILED } from "@/app/_components/opener-copy";
import { Status } from "@/app/_components/status";

function FailedView({ kind }: { kind: "outside-telegram" | "initialization-error" }): ReactElement {
  if (kind === "outside-telegram") {
    return <Status text={OUTSIDE_TELEGRAM} />;
  }
  return <Status text={START_FAILED} />;
}

export { FailedView };
