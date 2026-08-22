import { expect, vi } from "vitest";
import { render } from "vitest-browser-react";

import { test } from "@/test/browser/msw";

import type { LeaderboardEntry } from "../_lib/leaderboard-shape";

import { StandingsList } from "./standings-list";

vi.mock("./telegram-provider", () => ({
  useTelegramPlatform: () => ({
    hapticNotificationSuccess: vi.fn(),
    isInitialized: false,
  }),
}));

const entries: LeaderboardEntry[] = [
  {
    userId: 1,
    displayName: "@first_member",
    score: 12,
    isCrown: true,
    isChicken: false,
  },
  {
    userId: 2,
    displayName: "@second_member",
    score: 8,
    isCrown: false,
    isChicken: true,
  },
];

test("keeps standing cards mounted when their section becomes active", async () => {
  const screen = await render(
    <StandingsList entries={entries} isActive={false} />,
  );
  const cardsBeforeSelection = Array.from(
    screen.container.querySelectorAll("li"),
  );

  await screen.rerender(<StandingsList entries={entries} isActive />);

  const cardsAfterSelection = Array.from(
    screen.container.querySelectorAll("li"),
  );
  expect(cardsAfterSelection).toHaveLength(cardsBeforeSelection.length);
  expect(
    cardsAfterSelection.every(
      (card, index) => card === cardsBeforeSelection[index],
    ),
  ).toBe(true);
});
