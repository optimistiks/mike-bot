process.env.AI_GATEWAY_API_KEY ??= "test-gateway-key";

import { afterAll, afterEach, beforeAll } from "vitest";

import { modelServer, resetCapturedModelBodies } from "./msw";

beforeAll(() => {
  modelServer.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  resetCapturedModelBodies();
  modelServer.resetHandlers();
});

afterAll(() => {
  modelServer.close();
});
