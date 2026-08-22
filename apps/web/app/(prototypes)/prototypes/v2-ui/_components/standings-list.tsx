"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import type { LeaderboardEntry } from "../_lib/leaderboard-shape";

import { Button } from "@/components/ui/8bit/button";

import { useChangeCounter } from "../_lib/use-change-counter";
import { LAYOUT_SPRING } from "./motion-config";
import { StandingsEntry } from "./standings-entry";

/** Roughly a screenful, so a thirty-person Chat never buries first place. */
const VISIBLE_ENTRIES = 6;

/**
 * A section's standings, with everything past the first screenful behind a
 * reveal.
 *
 * Two separate animations meet here.
 *
 * The **reveal** re-fires every time this section becomes the active slide, so
 * each of the five gets its own entrance rather than being found pre-loaded.
 * It re-fires by remounting the rows: the reveal is not only the rows sliding
 * in but their scores counting up and their bars filling, and remounting is the
 * one thing that restarts all three together. The reveal counter is part of
 * each row's key, so a swipe back and forth replays the whole section.
 *
 * The **expansion** is a layout animation rather than a height transition. The
 * list itself is what animates — the `<ol>` springs to its new height while the
 * arriving rows fade in and the button that revealed them shrinks out — so the
 * section reads as one object growing rather than as a jump with some rows
 * pasted on. Being a spring makes it interruptible for free: driven mid-flight
 * it retargets from wherever it currently is instead of restarting, so
 * scrolling or tapping during the growth never feels like waiting.
 */
export function StandingsList({
  entries,
  isActive,
}: {
  entries: LeaderboardEntry[];
  /** Whether this section is the slide the filmstrip is currently on. */
  isActive: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const reveal = useChangeCounter(isActive, (from, to) => !from && to);

  // Entries arrive ranked, so the first one sets the scale every bar is drawn
  // against.
  const leaderScore = entries[0]?.score ?? 0;
  const visible = isExpanded ? entries : entries.slice(0, VISIBLE_ENTRIES);

  return (
    <div className="flex flex-col gap-4">
      <motion.ol layout transition={LAYOUT_SPRING} className="arcade-standings">
        {visible.map((entry, index) => (
          <StandingsEntry
            key={`${String(entry.userId)}-${String(reveal)}`}
            rank={index + 1}
            index={index}
            entry={entry}
            leaderScore={leaderScore}
          />
        ))}
      </motion.ol>

      <AnimatePresence initial={false}>
        {!isExpanded && entries.length > VISIBLE_ENTRIES && (
          <motion.div
            layout
            exit={{ opacity: 0, scale: 0.9 }}
            transition={LAYOUT_SPRING}
            className="self-center"
          >
            <Button
              variant="outline"
              className="arcade-text-sm"
              onClick={() => {
                setIsExpanded(true);
              }}
            >
              показать всех
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
