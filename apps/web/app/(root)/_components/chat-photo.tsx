"use client";

import { useQuery } from "@tanstack/react-query";

import { Avatar, AvatarFallback } from "@/components/ui/8bit/avatar";
import { cn } from "@/lib/utils";

import type { MiniAppChat } from "../_lib/chat";
import { displayInitials } from "../_lib/initials";
import { chatPhotoOptions } from "../_lib/queries";
import type { TelegramPlatform } from "../_lib/telegram-platform";
import { BlobImage } from "./blob-image";
import { photoSizes, type PhotoSize } from "./photo-size";
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
  size = "md",
}: {
  chat: MiniAppChat;
  size?: PhotoSize;
}) {
  const { platform } = useTelegramPlatform();
  const { frame, initials } = photoSizes[size];

  return (
    <Avatar variant="pixel" className={frame}>
      {chat.photoVersion && platform ? (
        <BlobPhoto
          key={chat.photoVersion}
          chat={{ ...chat, photoVersion: chat.photoVersion }}
          platform={platform}
        />
      ) : null}
      <AvatarFallback className={cn("arcade-initials bg-primary", initials)}>
        {displayInitials(chat.title)}
      </AvatarFallback>
    </Avatar>
  );
}
