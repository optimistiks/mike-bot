import type { LeaderboardResponse } from "@/lib/leaderboard/schema";

/**
 * The production Leaderboard response's own section and entry types, named once.
 *
 * This is the prototype's single seam. Components consume these rather than
 * deriving their own aliases, so there is exactly one place that says what shape
 * the standings arrive in — and pointing the components at the real endpoint
 * later changes nothing but where the data comes from.
 *
 * The fixture builder is `server-only`, so the shape cannot live alongside it:
 * client components need it too.
 */
export type LeaderboardSection = LeaderboardResponse["sections"][number];

export type LeaderboardEntry = LeaderboardSection["entries"][number];
