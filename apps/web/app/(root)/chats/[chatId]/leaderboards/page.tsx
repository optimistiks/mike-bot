import { redirect } from "next/navigation";
import { connection } from "next/server";

import { getCurrentSeason } from "@/lib/scoring";

import { leaderboardHref } from "../../../_lib/periods";

/** A redirect with no UI: see the note on the entry point. */
export const instant = false;

export default async function LeaderboardsIndexPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;

  // Which Season is current is a fact about now, and `getCurrentSeason()` reads
  // the clock. Waiting for a request is what makes that legal here; prerender
  // has no clock to read, and would fail the build over it.
  await connection();

  redirect(leaderboardHref(Number(chatId), getCurrentSeason()));
}
