import { notFound } from "next/navigation";

import {
  buildLeaderboard,
  findPrototypeChat,
} from "../../../../_lib/leaderboard-fixture.server";
import { LeaderboardScreen } from "../../../../_components/leaderboard-screen";

export default async function YearLeaderboardPrototypePage({
  params,
}: {
  params: Promise<{ chatId: string; year: string }>;
}) {
  const { chatId, year } = await params;
  const chat = findPrototypeChat(Number(chatId));

  if (!chat) notFound();

  return (
    <LeaderboardScreen
      chat={chat}
      leaderboard={buildLeaderboard(chat.id, { year: Number(year) })}
    />
  );
}
