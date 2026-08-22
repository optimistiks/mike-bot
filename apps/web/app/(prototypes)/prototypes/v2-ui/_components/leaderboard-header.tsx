"use client";

import { AnimatePresence, motion } from "motion/react";

import type { PrototypeChat } from "../_lib/chats";
import type { PrototypeSeason } from "../_lib/seasons";

import { ChatMorph } from "./chat-morph";
import { SeasonDrawer } from "./season-drawer";

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
  section,
}: {
  chat: PrototypeChat;
  season: PrototypeSeason;
  /**
   * Which of the five sections the filmstrip is on, or nothing at all when
   * there is no filmstrip to be on. An empty Season leaves tier two out rather
   * than naming a section that does not exist — but never tier one, because the
   * Season chip up there is how a Member leaves an empty Season.
   */
  section?: { title: string };
}) {
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
            <SeasonDrawer chatId={chat.id} season={season} />
          </div>
        </div>
      </ChatMorph>

      {section !== undefined && (
        <div className="px-4 pb-3">
          <div className="arcade-header-title">
            <AnimatePresence initial={false}>
              <motion.h2
                key={section.title}
                className="arcade-header-title-text arcade-text-md text-secondary"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                {section.title}
              </motion.h2>
            </AnimatePresence>
          </div>
        </div>
      )}
    </header>
  );
}
