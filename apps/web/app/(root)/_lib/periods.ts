import { getCurrentSeason, type Season } from "@/lib/scoring";
import type { LeaderboardPeriod } from "@/lib/leaderboard/schema";

export const MONTH_NAMES = [
  "январь",
  "февраль",
  "март",
  "апрель",
  "май",
  "июнь",
  "июль",
  "август",
  "сентябрь",
  "октябрь",
  "ноябрь",
  "декабрь",
] as const;

export const MONTH_SHORT_NAMES = [
  "ЯНВ",
  "ФЕВ",
  "МАР",
  "АПР",
  "МАЙ",
  "ИЮН",
  "ИЮЛ",
  "АВГ",
  "СЕН",
  "ОКТ",
  "НОЯ",
  "ДЕК",
] as const;

export function periodLabel(period: LeaderboardPeriod): string {
  if (period.kind === "year") return `${String(period.year)} · ВЕСЬ ГОД`;
  return `${MONTH_NAMES[period.month - 1]?.toUpperCase() ?? ""} ${String(period.year)}`;
}

export function leaderboardHref(
  chatId: number,
  period: LeaderboardPeriod | Season,
): string {
  const base = `/chats/${String(chatId)}/leaderboards/${String(period.year)}`;
  if (!("kind" in period) || period.kind === "season") {
    return `${base}/${String(period.month).padStart(2, "0")}`;
  }
  return base;
}

export function periodKey(period: LeaderboardPeriod): string {
  return period.kind === "year"
    ? `year:${String(period.year)}`
    : `season:${String(period.year)}-${String(period.month)}`;
}

export function isCurrentPeriod(period: LeaderboardPeriod): boolean {
  if (period.kind === "year") return false;
  const current = getCurrentSeason();
  return period.year === current.year && period.month === current.month;
}

export function availableSeasonSet(seasons: Season[]): Set<string> {
  return new Set(
    seasons.map((season) => `${String(season.year)}-${String(season.month)}`),
  );
}

export function pickableYears(seasons: Season[], now = new Date()): number[] {
  const currentYear = getCurrentSeason(now).year;
  const earliest = seasons[0]?.year ?? currentYear;
  return Array.from(
    { length: currentYear - earliest + 1 },
    (_, index) => earliest + index,
  );
}

export function currentPeriod(): LeaderboardPeriod {
  return { kind: "season", ...getCurrentSeason() };
}
