import { HttpResponse, http } from "msw";
import { act } from "react";
import { describe, expect, vi } from "vitest";
import { render } from "vitest-browser-react";

import { test } from "@/test/browser/msw";

import { MiniAppClient } from "./mini-app-client";
import type { MiniAppPlatform } from "./tma-platform";

const RAW_INIT_DATA = "user=untouched%20payload&auth_date=123&hash=signed";
const CHAT_ID = -100_456_789;

async function renderClient(props: Parameters<typeof MiniAppClient>[0]) {
  return render(<MiniAppClient {...props} />);
}

async function invokePlatformCallback(callback: VoidFunction) {
  const actEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };
  const previous = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

  try {
    await act(async () => {
      callback();
      await Promise.resolve();
    });
  } finally {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
}

function createPlatform(supportsNativeBackButton: boolean): {
  platform: MiniAppPlatform;
  ready: ReturnType<typeof vi.fn<MiniAppPlatform["ready"]>>;
  readNativeBack: () => VoidFunction | undefined;
} {
  let nativeBack: VoidFunction | undefined;
  const ready = vi.fn<MiniAppPlatform["ready"]>();
  const platform: MiniAppPlatform = {
    initDataRaw: RAW_INIT_DATA,
    supportsNativeBackButton,
    ready,
    setBackButton: vi.fn<MiniAppPlatform["setBackButton"]>(
      (visible, onBack) => {
        nativeBack = visible ? onBack : undefined;
        return () => {
          nativeBack = undefined;
        };
      },
    ),
  };

  return { platform, ready, readNativeBack: () => nativeBack };
}

describe("MiniAppClient platform boundary", () => {
  test("forwards untouched launch data after the Telegram shell renders", async ({
    worker,
  }) => {
    const { platform, ready } = createPlatform(true);
    ready.mockImplementation(() => {
      expect(document.body.textContent).toContain("Загрузка…");
    });
    let receivedAuthorization: string | null = null;
    worker.use(
      http.get("*/api/chats", ({ request }) => {
        receivedAuthorization = request.headers.get("authorization");
        return HttpResponse.json({
          chats: [{ chatId: CHAT_ID, label: "Друзья" }],
        });
      }),
    );

    const screen = await renderClient({
      launchMiniApp: () => Promise.resolve({ kind: "telegram", platform }),
    });

    await expect
      .element(screen.getByRole("button", { name: "Друзья" }))
      .toBeVisible();
    expect(receivedAuthorization).toBe(`tma ${RAW_INIT_DATA}`);
    expect(ready).toHaveBeenCalledOnce();
  });

  test("shows Russian Telegram guidance and makes no protected request outside TMA", async ({
    worker,
  }) => {
    let chatRequests = 0;
    let leaderboardRequests = 0;
    worker.use(
      http.get("*/api/chats", () => {
        chatRequests += 1;
        return HttpResponse.json({ chats: [] });
      }),
      http.get("*/api/leaderboard", () => {
        leaderboardRequests += 1;
        return HttpResponse.json({});
      }),
    );

    const screen = await renderClient({
      launchMiniApp: () => Promise.resolve({ kind: "outside-telegram" }),
    });

    await expect
      .element(screen.getByText(/откройте.*через Telegram/i))
      .toBeVisible();
    expect(chatRequests).toBe(0);
    expect(leaderboardRequests).toBe(0);
  });

  test("distinguishes a Telegram initialization failure without making a protected request", async ({
    worker,
  }) => {
    let protectedRequests = 0;
    worker.use(
      http.get("*/api/chats", () => {
        protectedRequests += 1;
        return HttpResponse.json({ chats: [] });
      }),
      http.get("*/api/leaderboard", () => {
        protectedRequests += 1;
        return HttpResponse.json({});
      }),
    );

    const screen = await renderClient({
      launchMiniApp: () => Promise.resolve({ kind: "initialization-error" }),
    });

    await expect
      .element(screen.getByText(/не удалось запустить/i))
      .toBeVisible();
    await expect
      .element(screen.getByText(/откройте.*через Telegram/i))
      .not.toBeInTheDocument();
    expect(protectedRequests).toBe(0);
  });

  test("uses the native Back Button for leaderboard navigation", async ({
    worker,
  }) => {
    const { platform, readNativeBack } = createPlatform(true);
    worker.use(
      http.get("*/api/chats", () =>
        HttpResponse.json({
          chats: [{ chatId: CHAT_ID, label: "Друзья" }],
        }),
      ),
      http.get("*/api/leaderboard", () =>
        HttpResponse.json({
          chatId: CHAT_ID,
          season: { year: 2026, month: 8 },
          isCurrentSeason: true,
          sections: [{ id: "karma", title: "Карма", entries: [] }],
        }),
      ),
    );

    const screen = await renderClient({
      launchMiniApp: () => Promise.resolve({ kind: "telegram", platform }),
    });
    await screen.getByRole("button", { name: "Друзья" }).click();
    await expect
      .element(screen.getByRole("heading", { name: "Карма" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: /к выбору чата/i }))
      .not.toBeInTheDocument();
    await expect.poll(readNativeBack).toBeTypeOf("function");

    const nativeBack = readNativeBack();
    if (!nativeBack) {
      throw new Error("Native Back Button callback was not registered");
    }
    await invokePlatformCallback(nativeBack);

    await expect
      .element(screen.getByRole("button", { name: "Друзья" }))
      .toBeVisible();
    await expect.poll(readNativeBack).toBeUndefined();
  });

  test("uses a visible fallback when the native Back Button is unavailable", async ({
    worker,
  }) => {
    const { platform } = createPlatform(false);
    worker.use(
      http.get("*/api/chats", () =>
        HttpResponse.json({
          chats: [{ chatId: CHAT_ID, label: "Друзья" }],
        }),
      ),
      http.get("*/api/leaderboard", () =>
        HttpResponse.json({
          chatId: CHAT_ID,
          season: { year: 2026, month: 8 },
          isCurrentSeason: true,
          sections: [],
        }),
      ),
    );

    const screen = await renderClient({
      launchMiniApp: () => Promise.resolve({ kind: "telegram", platform }),
    });
    await screen.getByRole("button", { name: "Друзья" }).click();

    const fallback = screen.getByRole("button", { name: /к выбору чата/i });
    await expect.element(fallback).toBeVisible();
    await fallback.click();
    await expect
      .element(screen.getByRole("button", { name: "Друзья" }))
      .toBeVisible();
  });
});
