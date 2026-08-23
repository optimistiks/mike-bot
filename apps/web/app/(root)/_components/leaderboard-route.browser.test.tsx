import { HttpResponse, http, type JsonBodyType } from "msw";
import { expect, vi } from "vitest";
import { render } from "vitest-browser-react";

import {
  MiniAppProviders,
  telegramContextStub,
  telegramPlatformStub,
} from "@/test/browser/mini-app";
import { test } from "@/test/browser/msw";

import { LeaderboardRoute } from "./leaderboard-route";

const telegram = vi.hoisted<{ context: unknown }>(() => ({
  context: null,
}));

vi.mock("./telegram-provider", () => ({
  useTelegramPlatform: () => telegram.context,
}));

// React's ViewTransition ships only in the canary React that Next aliases in at
// build time; the browser runner resolves plain React, where it is undefined.
// Both wrappers are presentational, so tests render their children directly.
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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/chats/-100456789/leaderboards/2026/08",
}));

const CHAT_ID = -100_456_789;
const PERIOD = { kind: "season", year: 2026, month: 8 } as const;

const SECTION_TITLES = [
  "Уважаемые люди",
  "Юмористы",
  "На позитиве",
  "Хотят смеяться 5 минут",
  "Как же у них горит",
];

function sections(entries: { userId: number; displayName: string }[]) {
  return SECTION_TITLES.map((title, index) => ({
    id: `section-${String(index)}`,
    title,
    entries: entries.map((entry, position) => ({
      ...entry,
      score: 10 - position,
      isCrown: position === 0,
      isChicken: position === entries.length - 1 && entries.length > 1,
    })),
  }));
}

function chatsHandler() {
  return http.get("*/api/chats", () =>
    HttpResponse.json({
      chats: [{ chatId: CHAT_ID, title: "Друзья", photoVersion: null }],
    }),
  );
}

function periodsHandler() {
  return http.get("*/api/leaderboard/periods", () =>
    HttpResponse.json({ seasons: [{ year: 2026, month: 8 }] }),
  );
}

// Standings ask for each Member's face; none of these tests are about photos,
// so every one is a Member without one.
function memberPhotosHandler() {
  return http.get(
    "*/api/members/:userId/photo",
    () => new HttpResponse(null, { status: 404 }),
  );
}

function leaderboardHandler(
  body: JsonBodyType = {
    chatId: CHAT_ID,
    period: PERIOD,
    sections: sections([
      { userId: 1, displayName: "@first_member" },
      { userId: 2, displayName: "@second_member" },
    ]),
  },
) {
  return http.get("*/api/leaderboard", () => HttpResponse.json(body));
}

async function renderLeaderboard() {
  telegram.context = telegramContextStub(telegramPlatformStub());

  return render(
    <MiniAppProviders>
      <LeaderboardRoute chatId={CHAT_ID} period={PERIOD} />
    </MiniAppProviders>,
  );
}

test("shows the Chat, its Season, and the standings", async ({ worker }) => {
  worker.use(
    chatsHandler(),
    periodsHandler(),
    leaderboardHandler(),
    memberPhotosHandler(),
  );

  const screen = await renderLeaderboard();

  await expect.element(screen.getByText("Друзья")).toBeVisible();
  await expect.element(screen.getByText("АВГУСТ 2026")).toBeVisible();
  await expect.element(screen.getByText("@first_member").first()).toBeVisible();
});

test("presents all five sections in the order the Leaderboard is read in", async ({
  worker,
}) => {
  worker.use(
    chatsHandler(),
    periodsHandler(),
    leaderboardHandler(),
    memberPhotosHandler(),
  );

  const screen = await renderLeaderboard();
  await expect.element(screen.getByText("Друзья")).toBeVisible();

  // Each slide names itself; the header shows only the active one.
  const slides = [...screen.container.querySelectorAll("section[aria-label]")];
  expect(slides.map((slide) => slide.getAttribute("aria-label"))).toEqual(
    SECTION_TITLES,
  );
  await expect
    .element(screen.getByRole("heading", { name: SECTION_TITLES[0] }))
    .toBeVisible();
});

test("replaces a Season with no Events with an empty state", async ({
  worker,
}) => {
  worker.use(
    chatsHandler(),
    periodsHandler(),
    leaderboardHandler({
      chatId: CHAT_ID,
      period: PERIOD,
      sections: sections([]),
    }),
    memberPhotosHandler(),
  );

  const screen = await renderLeaderboard();

  await expect.element(screen.getByText("НЕТ ДАННЫХ")).toBeVisible();
  // The Season chip survives an empty Season: it is the way out of one.
  await expect
    .element(screen.getByRole("button", { name: /АВГУСТ 2026/ }))
    .toBeVisible();
});

test("sends a Member without Registration back to register", async ({
  worker,
}) => {
  worker.use(
    chatsHandler(),
    periodsHandler(),
    http.get(
      "*/api/leaderboard",
      () => new HttpResponse(null, { status: 403 }),
    ),
  );

  const screen = await renderLeaderboard();

  await expect.element(screen.getByText("НЕТ ДОСТУПА К ЧАТУ")).toBeVisible();
});

test("refuses a Chat that is not the Member's, even when the Leaderboard loads", async ({
  worker,
}) => {
  worker.use(
    http.get("*/api/chats", () => HttpResponse.json({ chats: [] })),
    periodsHandler(),
    leaderboardHandler(),
    memberPhotosHandler(),
  );

  const screen = await renderLeaderboard();

  await expect.element(screen.getByText("НЕТ ДОСТУПА К ЧАТУ")).toBeVisible();
});

test("tells a Member with stale launch data to reopen the Mini App", async ({
  worker,
}) => {
  worker.use(
    chatsHandler(),
    periodsHandler(),
    http.get(
      "*/api/leaderboard",
      () => new HttpResponse(null, { status: 401 }),
    ),
  );

  const screen = await renderLeaderboard();

  await expect.element(screen.getByText("СЕССИЯ УСТАРЕЛА")).toBeVisible();
});
