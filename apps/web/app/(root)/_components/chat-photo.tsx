"use client";

import { useQuery } from "@tanstack/react-query";

import { Avatar, AvatarFallback } from "@/components/ui/8bit/avatar";

import type { MiniAppChat } from "../_lib/chat";
import { displayInitials } from "../_lib/initials";
import { chatPhotoOptions } from "../_lib/queries";
import type { TelegramPlatform } from "../_lib/telegram-platform";
import { BlobImage } from "./blob-image";
import { useTelegramPlatform } from "./telegram-provider";

function BlobPhoto({
  chat,
  platform,
}: {
  chat: MiniAppChat & { photoVersion: string };
  platform: TelegramPlatform;
}) {
  const query = useQuery(
    chatPhotoOptions(platform, chat.chatId, chat.photoVersion),
  );

  return query.data ? <BlobImage blob={query.data} /> : null;
}

export function ChatPhoto({
  chat,
  className = "size-12",
}: {
  chat: MiniAppChat;
  className?: string;
}) {
  const { platform } = useTelegramPlatform();
  return (
    <Avatar variant="pixel" className={className}>
      {chat.photoVersion && platform ? (
        <BlobPhoto
          key={chat.photoVersion}
          chat={{ ...chat, photoVersion: chat.photoVersion }}
          platform={platform}
        />
      ) : null}
      <AvatarFallback className="arcade-initials arcade-text-md bg-primary">
        {displayInitials(chat.title)}
      </AvatarFallback>
    </Avatar>
  );
}
