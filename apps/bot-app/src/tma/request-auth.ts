import "server-only";
import { env } from "@/env";

import type { OpenerProfile } from "./opener";

import { authenticateTmaOpener } from "./init-data";

function authenticateTmaRequestOpener(authorization: string | null): OpenerProfile | null {
  return authenticateTmaOpener(authorization, env.BOT_TOKEN);
}

export { authenticateTmaRequestOpener };
