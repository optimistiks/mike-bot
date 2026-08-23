"use client";

import { useQuery } from "@tanstack/react-query";

import { Avatar, AvatarFallback } from "@/components/ui/8bit/avatar";

import { displayInitials } from "../_lib/initials";
import { memberPhotoOptions } from "../_lib/queries";
import type { TelegramPlatform } from "../_lib/telegram-platform";
import { BlobImage } from "./blob-image";
import { useTelegramPlatform } from "./telegram-provider";

function MemberBlobPhoto({
  userId,
  platform,
}: {
  userId: number;
  platform: TelegramPlatform;
}) {
  const query = useQuery(memberPhotoOptions(platform, userId));

  return query.data ? <BlobImage blob={query.data} /> : null;
}

/**
 * A Member's face on the standings, or their initials.
 *
 * Unlike a Chat, nothing tells the Mini App in advance whether a Member has a
 * photo, so the request is made for everyone on screen and the initials stand
 * in until — or unless — one arrives. That is why the fallback is rendered
 * unconditionally rather than behind the query: a 404, a private profile, and a
 * slow network all have to look like a filled avatar, never a hole in the row.
 *
 * The same Member appears in several sections of one Leaderboard; the query is
 * keyed by Member alone, so all of those share a single fetch.
 */
export function MemberPhoto({
  userId,
  displayName,
  className = "size-8",
}: {
  userId: number;
  displayName: string;
  className?: string;
}) {
  const { platform } = useTelegramPlatform();

  return (
    <Avatar variant="pixel" className={className}>
      {platform ? (
        <MemberBlobPhoto userId={userId} platform={platform} />
      ) : null}
      <AvatarFallback className="arcade-initials arcade-text-xs bg-muted">
        {displayInitials(displayName)}
      </AvatarFallback>
    </Avatar>
  );
}
