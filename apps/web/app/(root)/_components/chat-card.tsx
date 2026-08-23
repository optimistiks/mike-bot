"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback } from "react";

import { Item, ItemContent, ItemMedia } from "@/components/ui/8bit/item";

import type { MiniAppChat } from "../_lib/chat";
import { currentPeriod, leaderboardHref } from "../_lib/periods";
import { leaderboardOptions, periodsOptions } from "../_lib/queries";
import { ChatMorph } from "./chat-morph";
import { ChatPhoto } from "./chat-photo";
import { useTelegramPlatform } from "./telegram-provider";

export function ChatCard({ chat }: { chat: MiniAppChat }) {
  const queryClient = useQueryClient();
  const { hapticImpact, platform } = useTelegramPlatform();
  const period = currentPeriod();
  const href = leaderboardHref(chat.chatId, period);

  const prefetch = useCallback(() => {
    if (!platform) return;
    void queryClient.prefetchQuery(
      leaderboardOptions(platform, chat.chatId, period),
    );
    void queryClient.prefetchQuery(periodsOptions(platform, chat.chatId));
  }, [chat.chatId, period, platform, queryClient]);

  return (
    <ChatMorph chatId={chat.chatId}>
      <Item
        render={
          <Link
            href={href}
            transitionTypes={["nav-forward"]}
            onPointerEnter={prefetch}
            onFocus={prefetch}
            onClick={() => {
              prefetch();
              hapticImpact();
            }}
          />
        }
        className="items-start gap-3 px-3 py-4"
      >
        <ItemMedia>
          <ChatPhoto chat={chat} />
        </ItemMedia>
        <ItemContent>
          <span className="arcade-body break-words">{chat.title}</span>
        </ItemContent>
      </Item>
    </ChatMorph>
  );
}
