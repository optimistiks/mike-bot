"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/8bit/avatar";

import type { MiniAppChat } from "../_lib/chat";
import { displayInitials } from "../_lib/initials";
import { chatPhotoOptions } from "../_lib/queries";
import type { TelegramPlatform } from "../_lib/telegram-platform";
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

function BlobImage({ blob }: { blob: Blob }) {
  const [url] = useState(() => URL.createObjectURL(blob));
  useEffect(() => {
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [url]);

  return <AvatarImage src={url} alt="" />;
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
      <AvatarFallback className="arcade-text-md bg-primary">
        {displayInitials(chat.title)}
      </AvatarFallback>
    </Avatar>
  );
}
