"use client";

import { AnimatePresence, motion } from "motion/react";

import { Progress } from "@/components/ui/8bit/progress";

import type { PrototypeChat } from "../_lib/chats";
import type { PrototypeSeason } from "../_lib/seasons";

import { ChatMorph } from "./chat-morph";
import { SeasonChip } from "./season-chip";

/**
 * The Leaderboard's two-tier header, which never scrolls.
 *
 * Tier one says where the Member is — which Chat, which Season — and tier two
 * says where they are inside it. The section title lives here rather than on the
 * slide precisely so that scrolling deep into a long section cannot take it
 * away, and it cross-fades rather than cutting so a swipe reads as one movement.
 */
export function LeaderboardHeader({
  chat,
  season,
  sectionTitles,
  activeIndex,
}: {
  chat: PrototypeChat;
  season: PrototypeSeason;
  sectionTitles: string[];
  activeIndex: number;
}) {
  // The index only ever comes from the carousel's own snap list, which is built
  // from these very sections, so it is always in range.
  const activeTitle = sectionTitles[activeIndex];

  return (
    <header className="arcade-header">
      {/* The other end of the Chat card's morph. The whole tier travels, not
          just the name, so the card lands as this row. */}
      <ChatMorph chatId={chat.id}>
        <div className="flex items-start gap-3 px-4 pt-4 pb-3">
          {/* A punishing Chat name wraps here rather than truncating; the chip
              beside it refuses to shrink so the Season is never squeezed out. */}
          <h1 className="arcade-text-md min-w-0 flex-1 leading-relaxed break-words text-primary">
            {chat.name}
          </h1>
          <div className="shrink-0">
            <SeasonChip chatId={chat.id} season={season} />
          </div>
        </div>
      </ChatMorph>

      <div className="flex flex-col gap-2 px-4 pb-3">
        <div className="arcade-header-title">
          <AnimatePresence initial={false}>
            <motion.h2
              key={activeTitle}
              className="arcade-header-title-text arcade-text-md text-secondary"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {activeTitle}
            </motion.h2>
          </AnimatePresence>
        </div>

        {/* How far through the five sections the Member has swiped, drawn in the
            same retro squares as the score bars. */}
        <Progress
          variant="retro"
          value={((activeIndex + 1) / sectionTitles.length) * 100}
          className="h-2"
          aria-label="Раздел"
        />
      </div>
    </header>
  );
}
