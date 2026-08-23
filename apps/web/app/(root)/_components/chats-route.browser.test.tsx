import { HttpResponse, http } from "msw";
import { expect, vi } from "vitest";
import { render } from "vitest-browser-react";

import {
  GO_REGISTER_EMPTY_STATE_HINT,
  GO_REGISTER_EMPTY_STATE_TITLE,
} from "@/lib/mini-app/copy";
import {
  MiniAppProviders,
  TEST_INIT_DATA,
  telegramContextStub,
  telegramPlatformStub,
} from "@/test/browser/mini-app";
import { test } from "@/test/browser/msw";

import { ChatsRoute } from "./chats-route";

const telegram = vi.hoisted<{ context: unknown }>(() => ({
  context: null,
}));

vi.mock("./telegram-provider", () => ({
  useTelegramPlatform: () => telegram.context,
}));

// React's ViewTransition ships only in the canary React that Next aliases in at
// build time; the browser runner resolves plain React, where it is undefined.
// The wrapper is presentational, so tests render its children directly.
vi.mock("./directional-transition", () => ({
  DirectionalTransition: ({ children }: { children: React.ReactNode }) =>
    children,
}));

vi.mock("./chat-morph", () => ({
  ChatMorph: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  return {
    __esModule: true,
    // A plain anchor: Next's Link needs an app-router context the browser
    // runner has no reason to provide. Every other prop is passed through, so
    // the card's own handlers still run.
    default: (props: { href: string; children?: React.ReactNode }) => {
      const attributes: Record<string, unknown> = { ...props };
      delete attributes.children;
      return createElement("a", attributes, props.children);
    },
  };
});

const CHAT_ID = -100_456_789;

async function renderChats(context?: unknown) {
  const platform = telegramPlatformStub();
  telegram.context = context ?? telegramContextStub(platform);

  return render(
    <MiniAppProviders>
      <ChatsRoute />
    </MiniAppProviders>,
  );
}

test("shows the Member's Chats", async ({ worker }) => {
  let authorization: string | null = null;
  worker.use(
    http.get("*/api/chats", ({ request }) => {
      authorization = request.headers.get("authorization");
      return HttpResponse.json({
        chats: [
          { chatId: CHAT_ID, title: "Друзья", photoVersion: null },
          { chatId: -100_1, title: "Соседи", photoVersion: null },
        ],
      });
    }),
  );

  const screen = await renderChats();

  await expect.element(screen.getByText("Друзья")).toBeVisible();
  await expect.element(screen.getByText("Соседи")).toBeVisible();
  expect(authorization).toBe(`tma ${TEST_INIT_DATA}`);
});

test("links each Chat to its Current Season", async ({ worker }) => {
  worker.use(
    http.get("*/api/chats", () =>
      HttpResponse.json({
        chats: [{ chatId: CHAT_ID, title: "Друзья", photoVersion: null }],
      }),
    ),
  );

  const screen = await renderChats();

  await expect.element(screen.getByRole("link")).toBeVisible();

  expect(screen.getByRole("link").element().getAttribute("href")).toMatch(
    new RegExp(`^/chats/${String(CHAT_ID)}/leaderboards/\\d{4}/\\d{2}$`),
  );
});

test("asks an unregistered Member to register instead of showing nothing", async ({
  worker,
}) => {
  worker.use(http.get("*/api/chats", () => HttpResponse.json({ chats: [] })));

  const screen = await renderChats();

  await expect
    .element(screen.getByText(GO_REGISTER_EMPTY_STATE_TITLE))
    .toBeVisible();
  await expect
    .element(screen.getByText(GO_REGISTER_EMPTY_STATE_HINT))
    .toBeVisible();
});

test("tells a Member with stale launch data to reopen the Mini App", async ({
  worker,
}) => {
  worker.use(
    http.get("*/api/chats", () => new HttpResponse(null, { status: 401 })),
  );

  const screen = await renderChats();

  await expect.element(screen.getByText("СЕССИЯ УСТАРЕЛА")).toBeVisible();
});

test("offers a retry when the Chats request fails outright", async ({
  worker,
}) => {
  worker.use(
    http.get("*/api/chats", () => new HttpResponse(null, { status: 500 })),
  );

  const screen = await renderChats();

  await expect
    .element(screen.getByText("НЕ УДАЛОСЬ ЗАГРУЗИТЬ ЧАТЫ"))
    .toBeVisible();
});

test("makes no protected request outside Telegram", async ({ worker }) => {
  const requests: string[] = [];
  worker.use(
    http.get("*/api/chats", ({ request }) => {
      requests.push(request.url);
      return HttpResponse.json({ chats: [] });
    }),
  );

  const screen = await renderChats({
    launch: { kind: "outside-telegram" },
    platform: null,
    isInitialized: true,
    supportsNativeBackButton: false,
    hapticImpact: vi.fn(),
    hapticSelection: vi.fn(),
    hapticNotificationSuccess: vi.fn(),
    interceptBack: vi.fn(() => () => undefined),
  });

  await expect.element(screen.getByText("ОТКРОЙ В TELEGRAM")).toBeVisible();
  expect(requests).toEqual([]);
});
