"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  ApiError,
  saveScoringReactions,
  scoringReactionsKey,
  scoringReactionsOptions,
} from "../_lib/queries";
import type { TelegramPlatform } from "../_lib/telegram-platform";
import { ArcadeLoading, ArcadeState } from "./arcade-state";
import { DirectionalTransition } from "./directional-transition";
import {
  ScoringReactionsEditor,
  type ChatBindings,
} from "./scoring-reactions-editor";
import { useTelegramPlatform } from "./telegram-provider";

function AuthenticatedSettings({
  chatId,
  platform,
}: {
  chatId: number;
  platform: TelegramPlatform;
}) {
  const queryClient = useQueryClient();
  const query = useQuery(scoringReactionsOptions(platform, chatId));

  const save = useMutation({
    mutationFn: (bindings: ChatBindings) => {
      const grouped: Record<string, string[]> = {};

      for (const [reactionKey, markType] of bindings) {
        if (markType === null) continue;
        (grouped[markType] ??= []).push(reactionKey);
      }

      return saveScoringReactions(platform, chatId, { bindings: grouped });
    },
    onSuccess: (saved) => {
      // The write answers with every binding, so there is nothing to guess
      // at: take it, then invalidate so anything else reading it catches up.
      queryClient.setQueryData(scoringReactionsKey(platform, chatId), saved);
      void queryClient.invalidateQueries({
        queryKey: scoringReactionsKey(platform, chatId),
      });
    },
  });

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

    if (query.error instanceof ApiError && query.error.status === 403) {
      return (
        <ArcadeState
          title="НЕТ ДОСТУПА"
          hint="Отправь /register в группе, чтобы открыть её."
        />
      );
    }

    return (
      <ArcadeState
        title="НЕ УДАЛОСЬ ЗАГРУЗИТЬ РЕАКЦИИ"
        hint="Проверь соединение и попробуй ещё раз."
        onRetry={() => void query.refetch()}
      />
    );
  }

  // Demoted between opening the screen and saving: the server is the authority,
  // so stop offering a Save the Chat will refuse.
  const wasDemoted =
    save.error instanceof ApiError && save.error.status === 403;

  return (
    <div className="arcade-screen gap-6 overflow-y-auto px-4 py-8">
      <h1 className="arcade-h1">Реакции</h1>
      <ScoringReactionsEditor
        reactions={query.data.reactions}
        canEdit={query.data.canEdit && !wasDemoted}
        isSaving={save.isPending}
        error={
          save.isError
            ? wasDemoted
              ? "Менять реакции могут только администраторы группы."
              : "Не удалось сохранить. Попробуй ещё раз."
            : null
        }
        onSave={(bindings) => {
          save.mutate(bindings);
        }}
      />
    </div>
  );
}

export function SettingsRoute({ chatId }: { chatId: number }) {
  const { launch, platform } = useTelegramPlatform();

  return (
    <DirectionalTransition name="page-settings">
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
        <AuthenticatedSettings chatId={chatId} platform={platform} />
      ) : null}
    </DirectionalTransition>
  );
}
