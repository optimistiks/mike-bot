"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";

import { Skeleton } from "@/components/ui/8bit/skeleton";

import type { MiniAppChat } from "../_lib/chat";

import { ChatMorph } from "./chat-morph";
import { ChatPhoto } from "./chat-photo";

/**
 * The Leaderboard's two-tier header, which never scrolls.
 *
 * Tier one says which Chat this is — the same face and the same name the Chat
 * card carried, which is what makes the morph between them read as one object
 * moving rather than two screens swapping. Tier two says where the Member is
 * inside it. The section title lives here rather than on the slide precisely so
 * that scrolling deep into a long section cannot take it away, and it
 * cross-fades rather than cutting so a swipe reads as one movement.
 *
 * The Season is deliberately not here any more: it is the screen's one action,
 * so it sits full-width at the bottom where a thumb already is, instead of
 * competing with the Chat name for the top row.
 */
export function LeaderboardHeader({
  chat,
  section,
  isPending = false,
}: {
  chat: MiniAppChat;
  /**
   * Which of the five sections the filmstrip is on, or nothing at all when
   * there is no filmstrip to be on. An empty Season leaves tier two out rather
   * than naming a section that does not exist.
   */
  section?: { title: string };
  /**
   * The standings have not arrived yet. Tier two holds its place with a bar
   * rather than collapsing, so the filmstrip below does not jump down the
   * moment the first section title lands.
   */
  isPending?: boolean;
}) {
  return (
    <header className="arcade-header">
      {/* The other end of the Chat card's morph. The whole tier travels —
          face and name together — so the card lands as this row. */}
      <ChatMorph chatId={chat.chatId}>
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <ChatPhoto chat={chat} />
          {/* A punishing Chat name wraps here rather than truncating. */}
          <h1 className="arcade-h1 min-w-0 flex-1 break-words">{chat.title}</h1>
          {/*
            Shown to every registered Member, not only administrators: the
            screen states what the Chat scores by, which is worth reading even
            when it cannot be changed. It refuses the save itself.
          */}
          <Link
            href={`/chats/${String(chat.chatId)}/settings`}
            className="arcade-label flex-none px-1"
            aria-label="Реакции"
          >
            ⚙
          </Link>
        </div>
      </ChatMorph>

      {isPending || section !== undefined ? (
        <div className="px-4 pb-3">
          <div className="arcade-header-title">
            {section === undefined ? (
              <Skeleton className="arcade-header-title-text h-3 w-40" />
            ) : (
              <AnimatePresence initial={false}>
                <motion.h2
                  key={section.title}
                  className="arcade-header-title-text arcade-h2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  {section.title}
                </motion.h2>
              </AnimatePresence>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
