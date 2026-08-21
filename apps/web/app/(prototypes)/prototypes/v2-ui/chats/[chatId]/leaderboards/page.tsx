import { redirect } from "next/navigation";

import { getCurrentSeason } from "@/lib/scoring";

import { leaderboardHref } from "../../../_lib/seasons";

/**
 * There is exactly one URL per Season, so a Leaderboard with no Season is not a
 * page — it resolves to the Current Season's own URL.
 */
export default async function LeaderboardsIndexPrototypePage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;

  redirect(leaderboardHref(Number(chatId), getCurrentSeason()));
}
