import "server-only";
import { sign } from "@tma.js/init-data-node";

import { requireBotToken } from "./env";
import { MOCK_OPENER } from "./mock-opener";

function signMockInitData(): string {
  return sign({ user: MOCK_OPENER }, requireBotToken(), new Date());
}

export { signMockInitData };
