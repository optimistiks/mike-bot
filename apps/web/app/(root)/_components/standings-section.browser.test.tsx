import { expect, vi } from "vitest";
import { render } from "vitest-browser-react";

import { test } from "@/test/browser/msw";

import type { LeaderboardSection } from "../_lib/leaderboard-shape";

import { StandingsSection } from "./standings-section";

vi.mock("./telegram-provider", () => ({
  useTelegramPlatform: () => ({
    hapticNotificationSuccess: vi.fn(),
    isInitialized: false,
  }),
}));

const section: LeaderboardSection = {
  id: "karma-received",
  title: "Уважаемые люди",
  entries: [],
};

test("states the emptiness on a section nobody scored in", async () => {
  const screen = await render(<StandingsSection section={section} isActive />);

  await expect
    .element(screen.getByRole("region", { name: "Уважаемые люди" }))
    .toBeVisible();
  await expect.element(screen.getByText("ПУСТО")).toBeVisible();
});

test("shows the standings when the section has entries", async () => {
  const screen = await render(
    <StandingsSection
      section={{
        ...section,
        entries: [
          {
            userId: 1,
            displayName: "@first_member",
            score: 12,
            isCrown: true,
            isChicken: false,
          },
        ],
      }}
      isActive
    />,
  );

  await expect.element(screen.getByText("@first_member")).toBeVisible();
  expect(screen.container.querySelectorAll("li")).toHaveLength(1);
});
