"use client";

import { useEffect, useState } from "react";

import type { LeaderboardResponse } from "@/lib/leaderboard/schema";
import type { ChatsResponse } from "@/lib/mini-app/schema";
import { getCurrentSeason, type Season } from "@/lib/scoring";

import { LeaderboardSections } from "./leaderboard-sections";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
      };
    };
  }
}

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

function readInitDataRaw(): string | null {
  const telegramInitData = window.Telegram?.WebApp?.initData;
  if (telegramInitData) {
    return telegramInitData;
  }

  if (process.env.NODE_ENV === "development") {
    const devUserId = new URLSearchParams(window.location.search).get(
      "devUserId",
    );
    if (devUserId) {
      return `user=${encodeURIComponent(JSON.stringify({ id: Number(devUserId) }))}`;
    }
  }

  return null;
}

async function fetchWithInitData<T>(path: string): Promise<T> {
  const initData = readInitDataRaw();
  if (!initData) {
    throw new Error("initData missing");
  }

  const response = await fetch(path, {
    headers: {
      Authorization: `tma ${initData}`,
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

export function MiniAppClient() {
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

  useEffect(() => {
    let cancelled = false;

    async function loadChats() {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchWithInitData<ChatsResponse>("/api/chats");
        if (!cancelled) {
          setChats(data.chats);
        }
      } catch {
        if (!cancelled) {
          setError(
            process.env.NODE_ENV === "development"
              ? "Не удалось загрузить чаты. В локальной разработке добавьте ?devUserId=101."
              : "Не удалось загрузить чаты.",
          );
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
  }, []);

  useEffect(() => {
    if (screen !== "leaderboard" || selectedChatId === null) {
      return;
    }

    const chatId = selectedChatId;
    let cancelled = false;

    async function loadLeaderboard() {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchWithInitData<LeaderboardResponse>(
          buildLeaderboardPath(chatId, season),
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
  }, [screen, selectedChatId, season]);

  function openChat(chatId: number, label: string) {
    setSelectedChatId(chatId);
    setSelectedChatLabel(label);
    setSeason(getCurrentSeason());
    setLeaderboard(null);
    setScreen("leaderboard");
  }

  function backToPicker() {
    setScreen("picker");
    setSelectedChatId(null);
    setLeaderboard(null);
    setError(null);
    setLoading(false);
  }

  if (screen === "picker") {
    return (
      <div className="mini-app">
        {loading ? <p>Загрузка…</p> : null}
        {error ? <p className="error">{error}</p> : null}

        {!loading && !error && chats.length === 0 ? (
          <div className="empty-state">
            <p>Нет общих чатов с ботом</p>
            <p className="hint">
              Добавьте бота в группу и откройте Mini App снова.
            </p>
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
      <button type="button" className="back-button" onClick={backToPicker}>
        ← К выбору чата
      </button>

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
