"use client";

import { useCallback, useEffect, useState } from "react";

import type { LeaderboardResponse } from "@/lib/leaderboard/schema";
import type { ChatsResponse } from "@/lib/mini-app/schema";
import {
  GO_REGISTER_EMPTY_STATE_HINT,
  GO_REGISTER_EMPTY_STATE_TITLE,
} from "@/lib/mini-app/copy";
import { getCurrentSeason, type Season } from "@/lib/scoring";

import { LeaderboardSections } from "./leaderboard-sections";
import {
  initializeTmaPlatform,
  type LaunchMiniApp,
  type MiniAppLaunch,
} from "./tma-platform";

type Screen = "picker" | "leaderboard";

const MONTH_NAMES = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
] as const;

async function fetchWithInitData<T>(
  path: string,
  initDataRaw: string,
): Promise<T> {
  const response = await fetch(path, {
    headers: {
      Authorization: `tma ${initDataRaw}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${String(response.status)}`);
  }

  return (await response.json()) as T;
}

function buildLeaderboardPath(chatId: number, season: Season): string {
  const params = new URLSearchParams({
    chat_id: String(chatId),
    year: String(season.year),
    month: String(season.month),
  });

  return `/api/leaderboard?${params.toString()}`;
}

function seasonOptions(now = new Date()): number[] {
  const currentYear = getCurrentSeason(now).year;
  return [currentYear - 2, currentYear - 1, currentYear];
}

function seasonsEqual(left: Season, right: Season): boolean {
  return left.year === right.year && left.month === right.month;
}

interface MiniAppClientProps {
  launchMiniApp?: LaunchMiniApp;
}

export function MiniAppClient({
  launchMiniApp = initializeTmaPlatform,
}: MiniAppClientProps = {}) {
  const [launch, setLaunch] = useState<MiniAppLaunch | null>(null);
  const [screen, setScreen] = useState<Screen>("picker");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatsResponse["chats"]>([]);
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const [selectedChatLabel, setSelectedChatLabel] = useState<string>("");
  const [season, setSeason] = useState<Season>(() => getCurrentSeason());
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(
    null,
  );

  const currentSeason = getCurrentSeason();
  const isCurrentSeason = seasonsEqual(season, currentSeason);
  const platform = launch?.kind === "telegram" ? launch.platform : null;

  useEffect(() => {
    let cancelled = false;

    void launchMiniApp().then((result) => {
      if (!cancelled) {
        setLaunch(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [launchMiniApp]);

  useEffect(() => {
    platform?.ready();
  }, [platform]);

  useEffect(() => {
    if (!platform) {
      return;
    }

    const launchedPlatform = platform;
    let cancelled = false;

    async function loadChats() {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchWithInitData<ChatsResponse>(
          "/api/chats",
          launchedPlatform.initDataRaw,
        );
        if (!cancelled) {
          setChats(data.chats);
        }
      } catch {
        if (!cancelled) {
          setError("Не удалось загрузить чаты.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadChats();

    return () => {
      cancelled = true;
    };
  }, [platform]);

  useEffect(() => {
    if (!platform || screen !== "leaderboard" || selectedChatId === null) {
      return;
    }

    const launchedPlatform = platform;
    const chatId = selectedChatId;
    let cancelled = false;

    async function loadLeaderboard() {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchWithInitData<LeaderboardResponse>(
          buildLeaderboardPath(chatId, season),
          launchedPlatform.initDataRaw,
        );
        if (!cancelled) {
          setLeaderboard(data);
        }
      } catch {
        if (!cancelled) {
          setError("Не удалось загрузить таблицу лидеров.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadLeaderboard();

    return () => {
      cancelled = true;
    };
  }, [platform, screen, selectedChatId, season]);

  function openChat(chatId: number, label: string) {
    setSelectedChatId(chatId);
    setSelectedChatLabel(label);
    setSeason(getCurrentSeason());
    setLeaderboard(null);
    setScreen("leaderboard");
  }

  const backToPicker = useCallback(() => {
    setScreen("picker");
    setSelectedChatId(null);
    setSelectedChatLabel("");
    setSeason(getCurrentSeason());
    setLeaderboard(null);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!platform) {
      return;
    }

    return platform.setBackButton(screen === "leaderboard", backToPicker);
  }, [backToPicker, platform, screen]);

  if (launch === null) {
    return (
      <div className="mini-app">
        <p>Загрузка…</p>
      </div>
    );
  }

  if (launch.kind === "outside-telegram") {
    return (
      <div className="mini-app empty-state">
        <p>Откройте мини-приложение через Telegram.</p>
        <p className="hint">Используйте кнопку меню у бота.</p>
      </div>
    );
  }

  if (launch.kind === "initialization-error") {
    return (
      <div className="mini-app empty-state">
        <p>Не удалось запустить мини-приложение.</p>
        <p className="hint">Закройте его и попробуйте открыть снова.</p>
      </div>
    );
  }

  if (screen === "picker") {
    return (
      <div className="mini-app">
        {loading ? <p>Загрузка…</p> : null}
        {error ? <p className="error">{error}</p> : null}

        {!loading && !error && chats.length === 0 ? (
          <div className="empty-state">
            <p>{GO_REGISTER_EMPTY_STATE_TITLE}</p>
            <p className="hint">{GO_REGISTER_EMPTY_STATE_HINT}</p>
          </div>
        ) : null}

        {!loading && chats.length > 0 ? (
          <ul className="chat-picker">
            {chats.map((chat) => (
              <li key={chat.chatId}>
                <button
                  type="button"
                  onClick={() => {
                    openChat(chat.chatId, chat.label);
                  }}
                >
                  {chat.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mini-app">
      {!platform?.supportsNativeBackButton ? (
        <button type="button" className="back-button" onClick={backToPicker}>
          ← К выбору чата
        </button>
      ) : null}

      <p className="selected-chat">{selectedChatLabel}</p>

      <div className="season-controls">
        <p className="season-label">
          {isCurrentSeason
            ? "Текущий сезон"
            : `Сезон ${String(season.year)}-${String(season.month).padStart(2, "0")}`}
        </p>

        <label>
          Год
          <select
            value={season.year}
            onChange={(event) => {
              setSeason((current) => ({
                ...current,
                year: Number(event.target.value),
              }));
            }}
          >
            {seasonOptions().map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>

        <label>
          Месяц
          <select
            value={season.month}
            onChange={(event) => {
              setSeason((current) => ({
                ...current,
                month: Number(event.target.value),
              }));
            }}
          >
            {MONTH_NAMES.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="season-reset"
          disabled={isCurrentSeason}
          onClick={() => {
            setSeason(getCurrentSeason());
          }}
        >
          Текущий сезон
        </button>
      </div>

      {loading ? <p>Загрузка…</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {leaderboard && !loading ? (
        <LeaderboardSections leaderboard={leaderboard} />
      ) : null}
    </div>
  );
}
