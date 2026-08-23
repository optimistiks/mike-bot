import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ArcadeLoading } from "../../../../_components/arcade-state";
import { LeaderboardRoute } from "../../../../_components/leaderboard-route";

/**
 * The params are awaited one component down, inside a boundary, so the arcade
 * frame and its loading skeleton are prerendered and painted before the route
 * is even known. That fallback is what the client renders anyway while Telegram
 * initializes, so nothing flashes on the way in.
 */
export default function YearLeaderboardPage({
  params,
}: {
  params: Promise<{ chatId: string; year: string }>;
}) {
  return (
    <Suspense fallback={<ArcadeLoading />}>
      <YearLeaderboard params={params} />
    </Suspense>
  );
}

async function YearLeaderboard({
  params,
}: {
  params: Promise<{ chatId: string; year: string }>;
}) {
  const values = await params;
  const chatId = Number(values.chatId);
  const year = Number(values.year);
  if (!Number.isSafeInteger(chatId) || !Number.isInteger(year)) notFound();

  return <LeaderboardRoute chatId={chatId} period={{ kind: "year", year }} />;
}
