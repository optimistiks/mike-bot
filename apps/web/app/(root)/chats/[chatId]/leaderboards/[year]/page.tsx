import { notFound } from "next/navigation";

import { LeaderboardRoute } from "../../../../_components/leaderboard-route";

export default async function YearLeaderboardPage({
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
