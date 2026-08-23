"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import type { TelegramPlatform } from "../_lib/telegram-platform";

function isLeaderboardPath(pathname: string): boolean {
  return /^\/chats\/-?\d+\/leaderboards(?:\/|$)/.test(pathname);
}

/**
 * Telegram's own back button, kept in step with where we are.
 *
 * This renders nothing, and that is the point: it exists to be the smallest
 * thing in the tree that reads the pathname. A route hook cannot resolve while
 * Next.js prerenders a shell for routes whose params are still unknown, so
 * wherever the read sits is where the shell stops — and it used to sit in the
 * provider that wraps the entire app. Suspending a leaf that renders null costs
 * nothing; suspending the provider would have cost the whole static shell.
 *
 * The handler comes down as a prop rather than out of context because it closes
 * over the provider's interceptor: the Season drawer takes the back button over
 * while it is open, and only the provider knows that.
 */
export function BackButtonSync({
  platform,
  onBack,
}: {
  platform: TelegramPlatform | null;
  onBack: VoidFunction;
}) {
  const pathname = usePathname();
  const showsBackButton = isLeaderboardPath(pathname);

  useEffect(
    () => platform?.setBackButton(showsBackButton, onBack),
    [onBack, platform, showsBackButton],
  );

  return null;
}
