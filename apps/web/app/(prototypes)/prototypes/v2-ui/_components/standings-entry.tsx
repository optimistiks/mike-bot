import { Avatar, AvatarFallback } from "@/components/ui/8bit/avatar";
import {
  Item,
  ItemContent,
  ItemFooter,
  ItemHeader,
} from "@/components/ui/8bit/item";

import type { LeaderboardEntry } from "../_lib/leaderboard-shape";

import { displayInitials } from "../_lib/initials";
import { EntryFlair } from "./entry-flair";
import { RankChip } from "./rank-chip";
import { ScoreBar } from "./score-bar";

/**
 * One Member's standing, as three stacked lines rather than a table row.
 *
 * Columns cannot survive an arbitrary-length Display identity, which is the
 * whole reason for the shape: line 1 holds only short fixed-width things, line 2
 * gives the identity the entire width to wrap into, and line 3 carries the
 * score and its bar. Nothing here truncates.
 */
export function StandingsEntry({
  rank,
  entry,
  leaderScore,
}: {
  rank: number;
  entry: LeaderboardEntry;
  leaderScore: number;
}) {
  return (
    <Item render={<li />} variant="outline" size="sm" className="gap-y-3">
      <ItemHeader className="justify-start gap-3">
        <RankChip rank={rank} isCrown={entry.isCrown} />
        <Avatar variant="pixel" className="size-8">
          <AvatarFallback className="arcade-text-xs bg-muted">
            {displayInitials(entry.displayName)}
          </AvatarFallback>
        </Avatar>
        <EntryFlair isCrown={entry.isCrown} isChicken={entry.isChicken} />
      </ItemHeader>

      <ItemContent className="basis-full">
        <span className="arcade-entry-name arcade-text-md">
          {entry.displayName}
        </span>
      </ItemContent>

      <ItemFooter className="gap-3">
        <span className="arcade-entry-score arcade-text-md text-primary">
          {entry.score}
        </span>
        <ScoreBar score={entry.score} leaderScore={leaderScore} />
      </ItemFooter>
    </Item>
  );
}
