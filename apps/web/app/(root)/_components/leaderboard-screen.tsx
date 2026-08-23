"use client";

import { useState } from "react";

import { Skeleton } from "@/components/ui/8bit/skeleton";

import type { LeaderboardResponse } from "@/lib/leaderboard/schema";
import type { LeaderboardPeriod } from "@/lib/leaderboard/schema";
import type { Season } from "@/lib/scoring";

import type { MiniAppChat } from "../_lib/chat";

import { hasNoEntries } from "../_lib/leaderboard-shape";
import { LeaderboardHeader } from "./leaderboard-header";
import { SeasonDrawer } from "./season-drawer";
import { SeasonEmpty } from "./season-empty";
import { SectionCarousel } from "./section-carousel";

/**
 * The Leaderboard: a header that never moves, a filmstrip that does, and the
 * Season across the bottom.
 *
 * The screen owns which section is active because the two halves that care
 * about it are siblings — the carousel reports the snap, the header renders it.
 * Nothing here scrolls vertically; that happens inside a slide.
 *
 * The standings are optional, and that is the point of the shape. The Chat is
 * known from the cached Chat list the instant the route commits, so the header
 * — and with it the other end of the Chat card's morph — can be painted before
 * a single score has arrived. Only the filmstrip waits.
 *
 * A Season with no Events replaces the filmstrip rather than filling it with
 * five empty slides. The Season button is deliberately kept: it is the way out
 * of an empty Season.
 */
export function LeaderboardScreen({
  chat,
  period,
  leaderboard,
  availableSeasons,
}: {
  chat: MiniAppChat;
  /** From the URL, so the Season reads correctly before the response lands. */
  period: LeaderboardPeriod;
  leaderboard?: LeaderboardResponse;
  availableSeasons?: Season[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const sections = leaderboard?.sections;
  const isEmpty = sections !== undefined && hasNoEntries(sections);

  return (
    <div className="arcade-screen overflow-hidden">
      <LeaderboardHeader
        chat={chat}
        isPending={sections === undefined}
        section={
          sections === undefined || isEmpty
            ? undefined
            : { title: sections[activeIndex].title }
        }
      />

      {sections === undefined ? (
        <FilmstripSkeleton />
      ) : isEmpty ? (
        <SeasonEmpty period={period} />
      ) : (
        <SectionCarousel
          sections={sections}
          activeIndex={activeIndex}
          onSelect={setActiveIndex}
        />
      )}

      <footer className="arcade-footer">
        <SeasonDrawer
          chatId={chat.chatId}
          period={period}
          availableSeasons={availableSeasons}
        />
      </footer>
    </div>
  );
}

/**
 * A slide's worth of standings-shaped bars.
 *
 * Shaped like the thing it stands in for rather than like a generic spinner:
 * what arrives is a stack of cards, so what waits is a stack of cards, and the
 * screen does not re-lay-out around the answer.
 */
function FilmstripSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3.5 px-1.5 pt-3">
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} className="h-20 w-full" />
      ))}
    </div>
  );
}
