"use client";

import { useState } from "react";

import type { PrototypeChat } from "../_lib/chats";
import type { PrototypeLeaderboard } from "../_lib/leaderboard-fixture.server";

import { LeaderboardHeader } from "./leaderboard-header";
import { SectionCarousel } from "./section-carousel";

/**
 * The Leaderboard: a header that never moves over a filmstrip that does.
 *
 * The screen owns which section is active because the two halves that care
 * about it are siblings — the carousel reports the snap, the header renders it.
 * Nothing here scrolls vertically; that happens inside a slide.
 */
export function LeaderboardScreen({
  chat,
  leaderboard,
}: {
  chat: PrototypeChat;
  leaderboard: PrototypeLeaderboard;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="arcade-screen overflow-hidden">
      <LeaderboardHeader
        chat={chat}
        season={leaderboard.season}
        sectionTitles={leaderboard.sections.map((section) => section.title)}
        activeIndex={activeIndex}
      />
      <SectionCarousel
        sections={leaderboard.sections}
        onSelect={setActiveIndex}
      />
    </div>
  );
}
