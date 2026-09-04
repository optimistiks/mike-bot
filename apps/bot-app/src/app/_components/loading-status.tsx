import type { ReactElement } from "react";

import { LOADING } from "@/app/_components/opener-copy";
import { Status } from "@/app/_components/status";

function LoadingStatus(): ReactElement {
  return <Status text={LOADING} />;
}

export { LoadingStatus };
