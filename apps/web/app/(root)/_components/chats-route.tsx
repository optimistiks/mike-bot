"use client";

import { useQuery } from "@tanstack/react-query";

import {
  GO_REGISTER_EMPTY_STATE_HINT,
  GO_REGISTER_EMPTY_STATE_TITLE,
} from "@/lib/mini-app/copy";

import { ApiError, chatsOptions } from "../_lib/queries";
import type { TelegramPlatform } from "../_lib/telegram-platform";
import { ArcadeLoading, ArcadeState } from "./arcade-state";
import { ChatCard } from "./chat-card";
import { DirectionalTransition } from "./directional-transition";
import { useTelegramPlatform } from "./telegram-provider";

function AuthenticatedChats({ platform }: { platform: TelegramPlatform }) {
  const query = useQuery(chatsOptions(platform));

  if (query.isPending) return <ArcadeLoading />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 401) {
      return (
        <ArcadeState
          title="СЕССИЯ УСТАРЕЛА"
          hint="Закрой мини-приложение и открой его снова."
        />
      );
    }

    return (
      <ArcadeState
        title="НЕ УДАЛОСЬ ЗАГРУЗИТЬ ЧАТЫ"
        hint="Проверь соединение и попробуй ещё раз."
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (query.data.chats.length === 0) {
    return (
      <ArcadeState
        title={GO_REGISTER_EMPTY_STATE_TITLE}
        hint={GO_REGISTER_EMPTY_STATE_HINT}
      />
    );
  }

  return (
    <div className="arcade-screen gap-6 overflow-y-auto px-4 py-8">
      <h1 className="arcade-text-lg text-primary">Выбери чат</h1>
      <div className="flex flex-col gap-2">
        {query.data.chats.map((chat) => (
          <ChatCard key={chat.chatId} chat={chat} />
        ))}
      </div>
    </div>
  );
}

export function ChatsRoute() {
  const { launch, platform } = useTelegramPlatform();

  return (
    <DirectionalTransition>
      {launch === null ? (
        <ArcadeLoading />
      ) : launch.kind === "outside-telegram" ? (
        <ArcadeState
          title="ОТКРОЙ В TELEGRAM"
          hint="Запусти мини-приложение из меню бота."
        />
      ) : launch.kind === "initialization-error" ? (
        <ArcadeState
          title="НЕ УДАЛОСЬ ЗАПУСТИТЬ"
          hint="Закрой мини-приложение и открой его снова."
        />
      ) : platform ? (
        <AuthenticatedChats platform={platform} />
      ) : null}
    </DirectionalTransition>
  );
}
