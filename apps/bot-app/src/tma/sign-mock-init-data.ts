import "server-only";
import { sign } from "@tma.js/init-data-node";

import { env } from "@/env";

import { MOCK_OPENER } from "./mock-opener";

function signMockInitData(): string {
  return sign({ user: MOCK_OPENER }, env.BOT_TOKEN, new Date());
}

export { signMockInitData };
