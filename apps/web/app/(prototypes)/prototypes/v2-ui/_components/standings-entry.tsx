"use client";

import { motion } from "motion/react";

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
import { LAYOUT_SPRING, ROW_SPRING, staggerDelay } from "./motion-config";
import { RankChip } from "./rank-chip";
import { ScoreBar } from "./score-bar";
import { ScoreCounter } from "./score-counter";

/**
 * One Member's standing, as three stacked lines rather than a table row.
 *
 * Columns cannot survive an arbitrary-length Display identity, which is the
 * whole reason for the shape: line 1 holds only short fixed-width things, line 2
 * gives the identity the entire width to wrap into, and line 3 carries the
 * score and its bar. Nothing here truncates.
 *
 * The row reveals itself on a spring, delayed by its own position in the list,
 * and the score and bar inside it start on the same delay so a row arrives as
 * one object. `layout` is what lets the rows below the "показать всех" button
 * slide down rather than jump when the list grows.
 */
export function StandingsEntry({
  rank,
  index,
  entry,
  leaderScore,
}: {
  rank: number;
  /** Position in the rendered list, which is what the stagger is drawn from. */
  index: number;
  entry: LeaderboardEntry;
  leaderScore: number;
}) {
  const delay = staggerDelay(index);

  return (
    <Item
      render={
        <motion.li
          layout
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...ROW_SPRING, delay, layout: LAYOUT_SPRING }}
        />
      }
      variant="outline"
      size="sm"
      className="gap-y-3"
    >
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
        <ScoreCounter
          score={entry.score}
          delay={delay}
          className="arcade-entry-score arcade-text-md text-primary"
        />
        <ScoreBar score={entry.score} leaderScore={leaderScore} delay={delay} />
      </ItemFooter>
    </Item>
  );
}
