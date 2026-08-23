"use client";

import { motion } from "motion/react";

import { Item, ItemContent, ItemHeader } from "@/components/ui/8bit/item";

import type { LeaderboardEntry } from "../_lib/leaderboard-shape";

import { EntryFlair } from "./entry-flair";
import { MemberPhoto } from "./member-photo";
import { LAYOUT_SPRING, staggerDelay } from "./motion-config";
import { RankChip } from "./rank-chip";
import { ScoreCounter } from "./score-counter";

/**
 * One Member's standing, as two stacked lines rather than a table row.
 *
 * Columns cannot survive an arbitrary-length Display identity, which is the
 * whole reason for the shape: line 1 anchors rank, avatar, flair, and score;
 * line 2 gives the identity the entire width to wrap into. Nothing truncates.
 *
 * The card keeps its DOM identity when the carousel selection changes. Only
 * the score remounts, replaying the staggered count-up without an opacity flash.
 * `layout` lets rows below "показать всех" slide down instead of jumping.
 */
export function StandingsEntry({
  rank,
  index,
  entry,
  reveal,
}: {
  rank: number;
  /** Position in the rendered list, which is what the stagger is drawn from. */
  index: number;
  entry: LeaderboardEntry;
  /** Changes whenever this section becomes active, replaying only the score. */
  reveal: number;
}) {
  const delay = staggerDelay(index);

  return (
    <Item
      render={<motion.li layout transition={{ layout: LAYOUT_SPRING }} />}
      variant="outline"
      size="sm"
      className="arcade-entry gap-y-2.5"
    >
      <ItemHeader className="justify-start gap-3">
        <RankChip rank={rank} isCrown={entry.isCrown} />
        <MemberPhoto userId={entry.userId} displayName={entry.displayName} />
        <EntryFlair isCrown={entry.isCrown} isChicken={entry.isChicken} />
        <ScoreCounter
          key={reveal}
          score={entry.score}
          delay={delay}
          className="arcade-entry-score arcade-numeral ml-auto"
        />
      </ItemHeader>

      <ItemContent className="basis-full">
        <span className="arcade-entry-name arcade-body">
          {entry.displayName}
        </span>
      </ItemContent>
    </Item>
  );
}
