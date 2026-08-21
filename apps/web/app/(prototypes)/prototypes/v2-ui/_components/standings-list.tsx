"use client";

import { useState } from "react";

import type { LeaderboardEntry } from "../_lib/leaderboard-shape";

import { Button } from "@/components/ui/8bit/button";

import { StandingsEntry } from "./standings-entry";

/** Roughly a screenful, so a thirty-person Chat never buries first place. */
const VISIBLE_ENTRIES = 6;

/**
 * A section's standings, with everything past the first screenful behind a
 * reveal. Ticket 06 gives the expansion its interruptible layout animation;
 * what it needs from here is that the reveal is a single state flip.
 */
export function StandingsList({ entries }: { entries: LeaderboardEntry[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Entries arrive ranked, so the first one sets the scale every bar is drawn
  // against.
  const leaderScore = entries[0]?.score ?? 0;
  const visible = isExpanded ? entries : entries.slice(0, VISIBLE_ENTRIES);

  return (
    <div className="flex flex-col gap-4">
      <ol className="arcade-standings">
        {visible.map((entry, index) => (
          <StandingsEntry
            key={entry.userId}
            rank={index + 1}
            entry={entry}
            leaderScore={leaderScore}
          />
        ))}
      </ol>

      {!isExpanded && entries.length > VISIBLE_ENTRIES && (
        <Button
          variant="outline"
          className="arcade-text-sm self-center"
          onClick={() => {
            setIsExpanded(true);
          }}
        >
          показать всех
        </Button>
      )}
    </div>
  );
}
