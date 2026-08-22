"use client";

import { useState } from "react";

import type { PrototypeChat } from "../_lib/chats";
import type { PrototypeLeaderboard } from "../_lib/leaderboard-fixture.server";

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
}: {
  chat: PrototypeChat;
  leaderboard: PrototypeLeaderboard;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const { sections } = leaderboard;
  const isEmpty = hasNoEntries(sections);

  return (
    <div className="arcade-screen overflow-hidden">
      <LeaderboardHeader
        chat={chat}
        season={leaderboard.season}
        section={
          isEmpty
            ? undefined
            : {
                title: sections[activeIndex].title,
              }
        }
      />
      {isEmpty ? (
        <SeasonEmpty season={leaderboard.season} />
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
