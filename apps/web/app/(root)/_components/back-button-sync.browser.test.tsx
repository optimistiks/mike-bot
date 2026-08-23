import { expect, vi } from "vitest";
import { render } from "vitest-browser-react";

import { telegramPlatformStub } from "@/test/browser/mini-app";
import { test } from "@/test/browser/msw";

import { BackButtonSync } from "./back-button-sync";

const route = vi.hoisted(() => ({ pathname: "/chats" }));

vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
}));

test("shows Telegram's back button on a Leaderboard and hides it elsewhere", async () => {
  const platform = telegramPlatformStub();
  const onBack = vi.fn();

  route.pathname = "/chats/-100456789/leaderboards/2026/08";
  const screen = await render(
    <BackButtonSync platform={platform} onBack={onBack} />,
  );

  expect(platform.setBackButton).toHaveBeenLastCalledWith(true, onBack);

  route.pathname = "/chats";
  await screen.rerender(<BackButtonSync platform={platform} onBack={onBack} />);

  expect(platform.setBackButton).toHaveBeenLastCalledWith(false, onBack);
});

test("does nothing before Telegram has handed over a platform", async () => {
  route.pathname = "/chats/-100456789/leaderboards/2026/08";

  const screen = await render(
    <BackButtonSync platform={null} onBack={vi.fn()} />,
  );

  expect(screen.container.innerHTML).toBe("");
});
