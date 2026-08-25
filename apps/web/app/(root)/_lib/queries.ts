"use client";

import { queryOptions } from "@tanstack/react-query";
import type { z } from "zod";

import {
  availablePeriodsResponseSchema,
  type LeaderboardPeriod,
  leaderboardResponseSchema,
} from "@/lib/leaderboard/schema";
import {
  scoringReactionsResponseSchema,
  type ScoringReactionsRequest,
  type ScoringReactionsResponse,
} from "@/lib/bot/scoring-reactions-schema";
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
  init?: RequestInit,
): Promise<z.infer<T>> {
  // `Headers` rather than an object spread: `HeadersInit` may be an array or a
  // `Headers`, and spreading either of those yields indices, not header names.
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `tma ${platform.initDataRaw}`);
  if (init?.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, { ...init, headers });
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

function scoringReactionsPath(chatId: number): string {
  return `/api/chats/${String(chatId)}/scoring-reactions`;
}

export function scoringReactionsKey(
  platform: TelegramPlatform,
  chatId: number,
) {
  return ["member", platform.memberId, "chat", chatId, "scoring-reactions"];
}

/**
 * What a Chat scores by, and whether this Member may change it.
 *
 * Short `staleTime`: unlike a Leaderboard, this is a thing the Member is here
 * to edit, and `canEdit` can go stale under them when Telegram demotes someone.
 */
export function scoringReactionsOptions(
  platform: TelegramPlatform,
  chatId: number,
) {
  return queryOptions({
    queryKey: scoringReactionsKey(platform, chatId),
    queryFn: () =>
      authenticatedJson(
        scoringReactionsPath(chatId),
        platform,
        scoringReactionsResponseSchema,
      ),
    staleTime: 60_000,
  });
}

/** Save every Reaction binding a Chat holds. The payload is state, not a diff. */
export function saveScoringReactions(
  platform: TelegramPlatform,
  chatId: number,
  request: ScoringReactionsRequest,
): Promise<ScoringReactionsResponse> {
  return authenticatedJson(
    scoringReactionsPath(chatId),
    platform,
    scoringReactionsResponseSchema,
    { method: "PUT", body: JSON.stringify(request) },
  );
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
