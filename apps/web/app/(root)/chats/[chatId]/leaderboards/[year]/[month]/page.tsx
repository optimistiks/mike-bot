import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ArcadeLoading } from "../../../../../_components/arcade-state";
import { LeaderboardRoute } from "../../../../../_components/leaderboard-route";

/** Same shape as the annual page: see the note there. */
export default function MonthLeaderboardPage({
  params,
}: {
  params: Promise<{ chatId: string; year: string; month: string }>;
}) {
  return (
    <Suspense fallback={<ArcadeLoading />}>
      <MonthLeaderboard params={params} />
    </Suspense>
  );
}

async function MonthLeaderboard({
  params,
}: {
  params: Promise<{ chatId: string; year: string; month: string }>;
}) {
  const values = await params;
  const chatId = Number(values.chatId);
  const year = Number(values.year);
  const month = Number(values.month);
  if (
    !Number.isSafeInteger(chatId) ||
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    notFound();
  }

  return (
    <LeaderboardRoute
      chatId={chatId}
      period={{ kind: "season", year, month }}
    />
  );
}
