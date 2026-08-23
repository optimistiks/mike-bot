"use client";

import { useQuery } from "@tanstack/react-query";

import type { LeaderboardPeriod } from "@/lib/leaderboard/schema";

import {
  ApiError,
  chatsOptions,
  leaderboardOptions,
  periodsOptions,
} from "../_lib/queries";
import type { TelegramPlatform } from "../_lib/telegram-platform";
import { ArcadeLoading, ArcadeState } from "./arcade-state";
import { DirectionalTransition } from "./directional-transition";
import { LeaderboardScreen } from "./leaderboard-screen";
import { useTelegramPlatform } from "./telegram-provider";

function AuthenticatedLeaderboard({
  chatId,
  period,
  platform,
}: {
  chatId: number;
  period: LeaderboardPeriod;
  platform: TelegramPlatform;
}) {
  const chats = useQuery(chatsOptions(platform));
  const leaderboard = useQuery(leaderboardOptions(platform, chatId, period));
  const periods = useQuery(periodsOptions(platform, chatId));
  const retry = () => {
    void Promise.all([
      chats.refetch(),
      leaderboard.refetch(),
      periods.refetch(),
    ]);
  };

  // Only the Chat list gates the whole screen. Everything else the Leaderboard
  // needs is rendered around, because the Chat is what the header — and with it
  // the far end of the Chat card's morph — is made of, and it is already in
  // cache the moment the route commits.
  if (chats.isPending) {
    return <ArcadeLoading />;
  }
  if (chats.isError || leaderboard.isError || periods.isError) {
    const errors = [chats.error, leaderboard.error, periods.error];
    const authError = errors.find(
      (error): error is ApiError =>
        error instanceof ApiError && [401, 403, 404].includes(error.status),
    );

    if (authError?.status === 401) {
      return (
        <ArcadeState
          title="СЕССИЯ УСТАРЕЛА"
          hint="Закрой мини-приложение и открой его снова."
        />
      );
    }
    if (authError) {
      return (
        <ArcadeState
          title="НЕТ ДОСТУПА К ЧАТУ"
          hint="Зарегистрируйся в этом чате через сообщение бота."
        />
      );
    }

    return (
      <ArcadeState
        title="НЕ УДАЛОСЬ ЗАГРУЗИТЬ РЕЙТИНГ"
        hint="Проверь соединение и попробуй ещё раз."
        onRetry={retry}
      />
    );
  }

  const chat = chats.data.chats.find((entry) => entry.chatId === chatId);
  if (!chat) {
    return (
      <ArcadeState
        title="НЕТ ДОСТУПА К ЧАТУ"
        hint="Зарегистрируйся в этом чате через сообщение бота."
      />
    );
  }

  return (
    // A flex column, not a plain block: the screen inside claims the height
    // with `flex: 1`, and a block wrapper would leave it at content height —
    // which collapses the filmstrip, and with it the area a swipe can start in,
    // whenever the sections are short or empty.
    <div className="relative flex h-full min-h-0 flex-col">
      <LeaderboardScreen
        chat={chat}
        period={period}
        leaderboard={leaderboard.data}
        availableSeasons={periods.data?.seasons}
      />
    </div>
  );
}

export function LeaderboardRoute({
  chatId,
  period,
}: {
  chatId: number;
  period: LeaderboardPeriod;
}) {
  const { launch, platform } = useTelegramPlatform();

  return (
    <DirectionalTransition name="page-leaderboard">
      {launch === null ? (
        <ArcadeLoading />
      ) : launch.kind === "outside-telegram" ? (
        <ArcadeState title="ОТКРОЙ В TELEGRAM" />
      ) : launch.kind === "initialization-error" ? (
        <ArcadeState title="НЕ УДАЛОСЬ ЗАПУСТИТЬ" />
      ) : platform ? (
        <AuthenticatedLeaderboard
          chatId={chatId}
          period={period}
          platform={platform}
        />
      ) : null}
    </DirectionalTransition>
  );
}
