import { redirect } from "next/navigation";

import { getCurrentSeason } from "@/lib/scoring";

import { leaderboardHref } from "../../../_lib/periods";

export default async function LeaderboardsIndexPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;
  redirect(leaderboardHref(Number(chatId), getCurrentSeason()));
}
