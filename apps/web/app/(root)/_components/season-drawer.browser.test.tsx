import { HttpResponse, http } from "msw";
import { expect, vi } from "vitest";
import { render } from "vitest-browser-react";

import {
  MiniAppProviders,
  telegramContextStub,
  telegramPlatformStub,
} from "@/test/browser/mini-app";
import { test } from "@/test/browser/msw";

import { SeasonDrawer } from "./season-drawer";

/**
 * The drawer animates for as long as it is open, so Playwright never calls its
 * cells "stable" and the usual `.click()` times out waiting. Dispatching the
 * click on the resolved element is the same event the component listens for.
 */
function click(locator: { element: () => Element }): void {
  (locator.element() as HTMLElement).click();
}

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
const telegram = vi.hoisted<{ context: unknown }>(() => ({
  context: null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/chats/-100456789/leaderboards/2026/08",
}));

vi.mock("./telegram-provider", () => ({
  useTelegramPlatform: () => telegram.context,
}));

const CHAT_ID = -100_456_789;
const AVAILABLE_SEASONS = [
  { year: 2025, month: 12 },
  { year: 2026, month: 7 },
  { year: 2026, month: 8 },
];

async function openDrawer(
  period = { kind: "season", year: 2026, month: 8 } as const,
) {
  router.replace.mockClear();
  router.push.mockClear();
  telegram.context = telegramContextStub(telegramPlatformStub());

  const screen = await render(
    <MiniAppProviders>
      <SeasonDrawer
        chatId={CHAT_ID}
        period={period}
        availableSeasons={AVAILABLE_SEASONS}
      />
    </MiniAppProviders>,
  );

  click(screen.getByRole("button", { name: /2026/ }));
  await expect
    .element(screen.getByRole("heading", { name: "Сезон" }))
    .toBeVisible();

  return screen;
}

test("opens on the Season being viewed", async () => {
  const screen = await openDrawer();

  await expect
    .element(screen.getByRole("button", { name: "АВГ" }))
    .toHaveAttribute("aria-pressed", "true");
});

test("replaces the Season rather than pushing it, so back still means the Chat list", async ({
  worker,
}) => {
  worker.use(
    http.get("*/api/leaderboard", () =>
      HttpResponse.json({
        chatId: CHAT_ID,
        period: { kind: "season", year: 2026, month: 7 },
        sections: [],
      }),
    ),
  );
  const screen = await openDrawer();

  click(screen.getByRole("button", { name: "ИЮЛ" }));

  expect(router.replace).toHaveBeenCalledWith(
    "/chats/-100456789/leaderboards/2026/07",
  );
  expect(router.push).not.toHaveBeenCalled();
});

test("reaches a whole year from the drawer", async ({ worker }) => {
  worker.use(
    http.get("*/api/leaderboard", () =>
      HttpResponse.json({
        chatId: CHAT_ID,
        period: { kind: "year", year: 2026 },
        sections: [],
      }),
    ),
  );
  const screen = await openDrawer();

  click(screen.getByRole("button", { name: "ВЕСЬ ГОД" }));

  expect(router.replace).toHaveBeenCalledWith(
    "/chats/-100456789/leaderboards/2026",
  );
});

test("closes once a Season is chosen", async ({ worker }) => {
  worker.use(
    http.get("*/api/leaderboard", () =>
      HttpResponse.json({
        chatId: CHAT_ID,
        period: { kind: "season", year: 2026, month: 7 },
        sections: [],
      }),
    ),
  );
  const screen = await openDrawer();

  click(screen.getByRole("button", { name: "ИЮЛ" }));

  await expect
    .element(screen.getByRole("heading", { name: "Сезон" }))
    .not.toBeInTheDocument();
});
