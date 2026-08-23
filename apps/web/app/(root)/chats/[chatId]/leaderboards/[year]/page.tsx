import { notFound } from "next/navigation";

import { LeaderboardRoute } from "../../../../_components/leaderboard-route";

/**
 * The params are awaited here, in the page, with no boundary under them — which
 * costs this route its prerendered shell, and buys the transition that matters.
 *
 * A Suspense fallback is a *commit*: React would land the new route as a
 * skeleton, and a skeleton holds no Chat name, so the shared-element morph out
 * of the Chat card has nothing to pair with and silently degrades to a cut. The
 * page renders nothing but client-component references and fetches no data, so
 * awaiting the params resolves immediately; the `.arcade` shell itself lives in
 * the layout and is prerendered either way.
 */
export const instant = false;

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
