"use client";

import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/8bit/avatar";
import { Item, ItemContent, ItemMedia } from "@/components/ui/8bit/item";

import { ChatMorph } from "./chat-morph";
import { useTelegramPlatform } from "./telegram-provider";

export function ChatCard({
  chatId,
  href,
  name,
  initials,
}: {
  chatId: number;
  href: string;
  name: string;
  initials: string;
}) {
  const { hapticImpact } = useTelegramPlatform();

  return (
    // The other end of this morph is the Leaderboard header's first tier, so
    // tapping a Chat reads as that card travelling rather than the page being
    // replaced.
    <ChatMorph chatId={chatId}>
      <Item
        render={<Link href={href} onClick={hapticImpact} />}
        className="items-start gap-3 px-3 py-4"
      >
        <ItemMedia>
          <Avatar variant="pixel" className="size-12">
            <AvatarFallback className="arcade-text-md bg-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
        </ItemMedia>
        {/* No truncation anywhere: a Chat name gets as many lines as it needs. */}
        <ItemContent>
          <span className="arcade-text-md leading-relaxed break-words">
            {name}
          </span>
        </ItemContent>
      </Item>
    </ChatMorph>
  );
}
