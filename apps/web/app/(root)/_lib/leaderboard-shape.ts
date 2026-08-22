import type { LeaderboardResponse } from "@/lib/leaderboard/schema";

/**
 * The production Leaderboard response's own section and entry types, named once.
 *
 * This is the UI's single seam. Components consume these rather than
 * deriving their own aliases, so there is exactly one place that says what shape
 * the standings arrive in from the real endpoint.
 */
export type LeaderboardSection = LeaderboardResponse["sections"][number];

export type LeaderboardEntry = LeaderboardSection["entries"][number];

/**
 * Whether a Season holds no Events at all.
 *
 * Reading it off the sections keeps it on the client side of the seam, where
 * the screen chooses between the filmstrip and the empty state.
 */
export function hasNoEntries(sections: LeaderboardSection[]): boolean {
  return sections.every((section) => section.entries.length === 0);
}
