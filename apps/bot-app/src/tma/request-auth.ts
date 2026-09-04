import "server-only";
import type { OpenerProfile } from "./opener";

import { botToken } from "./env";
import { authenticateTmaOpener } from "./init-data";

function authenticateTmaRequestOpener(authorization: string | null): OpenerProfile | null {
  const token = botToken();
  if (token === undefined) {
    return null;
  }
  return authenticateTmaOpener(authorization, token);
}

export { authenticateTmaRequestOpener };
