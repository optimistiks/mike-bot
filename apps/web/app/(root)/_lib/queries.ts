"use client";

import { queryOptions } from "@tanstack/react-query";
import type { z } from "zod";

import {
  availablePeriodsResponseSchema,
  type LeaderboardPeriod,
  leaderboardResponseSchema,
} from "@/lib/leaderboard/schema";
import { chatsResponseSchema } from "@/lib/mini-app/schema";
import { getCurrentSeason } from "@/lib/scoring";

import type { TelegramPlatform } from "./telegram-platform";

export class ApiError extends Error {
  constructor(public readonly status: number) {
    super(`Request failed: ${String(status)}`);
  }
}

async function authenticatedJson<T extends z.ZodType>(
  path: string,
  platform: TelegramPlatform,
  schema: T,
): Promise<z.infer<T>> {
  const response = await fetch(path, {
    headers: { Authorization: `tma ${platform.initDataRaw}` },
  });
  if (!response.ok) throw new ApiError(response.status);
  return schema.parse(await response.json());
}

export function chatsOptions(platform: TelegramPlatform) {
  return queryOptions({
    queryKey: ["member", platform.memberId, "chats"],
    queryFn: () =>
      authenticatedJson("/api/chats", platform, chatsResponseSchema),
    staleTime: 10 * 60 * 1_000,
  });
}

export function periodsOptions(platform: TelegramPlatform, chatId: number) {
  return queryOptions({
    queryKey: ["member", platform.memberId, "chat", chatId, "periods"],
    queryFn: () =>
      authenticatedJson(
        `/api/leaderboard/periods?chat_id=${String(chatId)}`,
        platform,
        availablePeriodsResponseSchema,
      ),
    staleTime: 10 * 60 * 1_000,
  });
}

export function leaderboardOptions(
  platform: TelegramPlatform,
  chatId: number,
  period: LeaderboardPeriod,
) {
  const currentSeason = getCurrentSeason();
  const params = new URLSearchParams({
    chat_id: String(chatId),
    year: String(period.year),
  });
  if (period.kind === "season") params.set("month", String(period.month));

  return queryOptions({
    queryKey: [
      "member",
      platform.memberId,
      "chat",
      chatId,
      "leaderboard",
      period,
    ],
    queryFn: () =>
      authenticatedJson(
        `/api/leaderboard?${params.toString()}`,
        platform,
        leaderboardResponseSchema,
      ),
    staleTime:
      period.kind === "season" &&
      period.year === currentSeason.year &&
      period.month === currentSeason.month
        ? 30_000
        : 30 * 60 * 1_000,
  });
}

export function chatPhotoOptions(
  platform: TelegramPlatform,
  chatId: number,
  photoVersion: string,
) {
  return queryOptions({
    queryKey: [
      "member",
      platform.memberId,
      "chat",
      chatId,
      "photo",
      photoVersion,
    ],
    queryFn: async () => {
      const response = await fetch(`/api/chats/${String(chatId)}/photo`, {
        headers: { Authorization: `tma ${platform.initDataRaw}` },
      });
      if (!response.ok) throw new ApiError(response.status);
      return response.blob();
    },
    staleTime: 60 * 60 * 1_000,
  });
}

/**
 * A Member's Telegram profile photo.
 *
 * Keyed by Member rather than by Chat, matching the endpoint: the same face
 * turns up in several sections of a Leaderboard and in several Chats, and it is
 * one fetch for all of them. Nothing versions it — a profile photo has no
 * identifier this app ever sees — so the hour-long `staleTime` is what decides
 * when a changed photo appears.
 */
export function memberPhotoOptions(platform: TelegramPlatform, userId: number) {
  return queryOptions({
    queryKey: ["member", platform.memberId, "member-photo", userId],
    queryFn: async () => {
      const response = await fetch(`/api/members/${String(userId)}/photo`, {
        headers: { Authorization: `tma ${platform.initDataRaw}` },
      });
      if (!response.ok) throw new ApiError(response.status);
      return response.blob();
    },
    staleTime: 60 * 60 * 1_000,
  });
}

export function retryApiRequest(failureCount: number, error: Error): boolean {
  if (
    error instanceof ApiError &&
    [400, 401, 403, 404].includes(error.status)
  ) {
    return false;
  }
  return failureCount < 2;
}
