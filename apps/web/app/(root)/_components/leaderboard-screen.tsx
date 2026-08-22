"use client";

import { useState } from "react";

import type { LeaderboardResponse } from "@/lib/leaderboard/schema";
import type { Season } from "@/lib/scoring";

import type { MiniAppChat } from "../_lib/chat";

import { hasNoEntries } from "../_lib/leaderboard-shape";
import { LeaderboardHeader } from "./leaderboard-header";
import { SeasonEmpty } from "./season-empty";
import { SectionCarousel } from "./section-carousel";

/**
 * The Leaderboard: a header that never moves over a filmstrip that does.
 *
 * The screen owns which section is active because the two halves that care
 * about it are siblings — the carousel reports the snap, the header renders it.
 * Nothing here scrolls vertically; that happens inside a slide.
 *
 * A Season with no Events replaces the filmstrip rather than filling it with
 * five empty slides. The header is deliberately kept: the Season chip inside it
 * is the way out of an empty Season.
 */
export function LeaderboardScreen({
  chat,
  leaderboard,
  availableSeasons,
}: {
  chat: MiniAppChat;
  leaderboard: LeaderboardResponse;
  availableSeasons: Season[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const { sections } = leaderboard;
  const isEmpty = hasNoEntries(sections);

  return (
    <div className="arcade-screen overflow-hidden">
      <LeaderboardHeader
        chat={chat}
        period={leaderboard.period}
        availableSeasons={availableSeasons}
        section={
          isEmpty
            ? undefined
            : {
                title: sections[activeIndex].title,
              }
        }
      />
      {isEmpty ? (
        <SeasonEmpty period={leaderboard.period} />
      ) : (
        <SectionCarousel
          sections={sections}
          activeIndex={activeIndex}
          onSelect={setActiveIndex}
        />
      )}
    </div>
  );
}
