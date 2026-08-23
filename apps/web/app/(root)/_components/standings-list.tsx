"use client";

import { useEffect, useRef } from "react";

import type { LeaderboardEntry } from "../_lib/leaderboard-shape";

import { useChangeCounter } from "../_lib/use-change-counter";
import { StandingsEntry } from "./standings-entry";
import { useTelegramPlatform } from "./telegram-provider";

/**
 * A section's standings, every Member of it, always.
 *
 * The list is never truncated: a Chat's standings are the whole Chat, and a
 * reveal control put the tail of it behind a tap that nobody reading a
 * scoreboard wants to make. Long Chats scroll, which is what phones are for.
 *
 * The **score reveal** re-fires every time this section becomes the active
 * slide. Cards keep their DOM identity throughout the gesture; only each
 * ScoreCounter remounts, so the number restarts from zero without the newly
 * selected standings disappearing for a frame.
 */
export function StandingsList({
  entries,
  isActive,
}: {
  entries: LeaderboardEntry[];
  /** Whether this section is the slide the filmstrip is currently on. */
  isActive: boolean;
}) {
  const reveal = useChangeCounter(isActive, (from, to) => !from && to);
  const { hapticNotificationSuccess, isInitialized } = useTelegramPlatform();
  const crownEntries = entries.filter((entry) => entry.isCrown);
  const hasCrown = crownEntries.length > 0;
  const crownRevealId = `${String(reveal)}:${crownEntries
    .map((entry) => `${String(entry.userId)}-${String(entry.score)}`)
    .join(":")}`;
  const notifiedCrownReveal = useRef<string | null>(null);

  useEffect(() => {
    if (
      !isInitialized ||
      !isActive ||
      !hasCrown ||
      notifiedCrownReveal.current === crownRevealId
    ) {
      return;
    }

    notifiedCrownReveal.current = crownRevealId;
    hapticNotificationSuccess();
  }, [
    crownRevealId,
    hasCrown,
    hapticNotificationSuccess,
    isActive,
    isInitialized,
  ]);

  return (
    <ol className="arcade-standings">
      {entries.map((entry, index) => (
        <StandingsEntry
          key={entry.userId}
          rank={index + 1}
          index={index}
          entry={entry}
          reveal={reveal}
        />
      ))}
    </ol>
  );
}
