import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createBot: vi.fn(),
  getRuntimeDb: vi.fn(),
  parseServerEnv: vi.fn(),
  webhookCallback: vi.fn(),
}));

vi.mock("grammy", () => ({ webhookCallback: mocks.webhookCallback }));
vi.mock("@/lib/bot/bot", () => ({ createBot: mocks.createBot }));
vi.mock("@/lib/db/runtime", () => ({ getRuntimeDb: mocks.getRuntimeDb }));
vi.mock("@/lib/env.server", () => ({ parseServerEnv: mocks.parseServerEnv }));

describe("Telegram webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reuses one grammY handler within a warm module instance", async () => {
    const db = {};
    const bot = {};
    const handler = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 200 })),
    );

    mocks.parseServerEnv.mockReturnValue({
      BOT_TOKEN: "token",
      BOT_WEBHOOK_SECRET: "secret",
    });
    mocks.getRuntimeDb.mockResolvedValue(db);
    mocks.createBot.mockReturnValue(bot);
    mocks.webhookCallback.mockReturnValue(handler);

    const route = await import("./route");
    const request = new Request("https://example.com/api/telegram", {
      method: "POST",
    });

    const [firstResponse, secondResponse] = await Promise.all([
      route.POST(request.clone()),
      route.POST(request.clone()),
    ]);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(mocks.parseServerEnv).toHaveBeenCalledOnce();
    expect(mocks.getRuntimeDb).toHaveBeenCalledOnce();
    expect(mocks.createBot).toHaveBeenCalledOnce();
    expect(mocks.webhookCallback).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("uses the platform defaults for caching, runtime, and duration", async () => {
    const route = await import("./route");

    expect(route).not.toHaveProperty("dynamic");
    expect(route).not.toHaveProperty("runtime");
    expect(route).not.toHaveProperty("maxDuration");
  });
});
