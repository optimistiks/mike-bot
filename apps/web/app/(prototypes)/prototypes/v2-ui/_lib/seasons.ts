import { getCurrentSeason, type Season } from "@/lib/scoring";

/**
 * A Season the prototype can address.
 *
 * Known domain gap, accepted deliberately: the glossary defines a Season as a
 * single calendar month, and the production Leaderboard API rejects a year
 * without a month. The full-year view therefore describes something the backend
 * cannot currently produce. The prototype builds it anyway to answer the design
 * question; extending the domain model is separate work.
 */
export interface PrototypeSeason {
  year: number;
  month?: number;
}

/** Nothing happened before this, so the empty state is always reachable. */
export const FIRST_SEASON: Season = { year: 2024, month: 1 };

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

/** Every year the Season picker offers, oldest first. 2023 is entirely empty. */
export function pickableYears(now = new Date()): number[] {
  const currentYear = getCurrentSeason(now).year;
  const years: number[] = [];
  for (let year = FIRST_SEASON.year - 1; year <= currentYear; year += 1) {
    years.push(year);
  }
  return years;
}

/** A Season holds Events only between the first Season and the current one. */
export function seasonHasData(season: Season, now = new Date()): boolean {
  const current = getCurrentSeason(now);
  const ordinal = season.year * 12 + season.month;

  return (
    ordinal >= FIRST_SEASON.year * 12 + FIRST_SEASON.month &&
    ordinal <= current.year * 12 + current.month
  );
}

/** The months of `year` that hold Events, in calendar order. */
export function monthsWithData(year: number, now = new Date()): number[] {
  const months: number[] = [];
  for (let month = 1; month <= 12; month += 1) {
    if (seasonHasData({ year, month }, now)) {
      months.push(month);
    }
  }
  return months;
}

export function isCurrentSeason(
  season: PrototypeSeason,
  now = new Date(),
): boolean {
  const current = getCurrentSeason(now);
  return season.year === current.year && season.month === current.month;
}

export function seasonLabel(season: PrototypeSeason): string {
  if (season.month === undefined) {
    return `${String(season.year)} · ВЕСЬ ГОД`;
  }

  return `${MONTH_NAMES[season.month - 1]?.toUpperCase() ?? ""} ${String(season.year)}`;
}

export function leaderboardHref(
  chatId: number,
  season: PrototypeSeason,
): string {
  const base = `/prototypes/v2-ui/chats/${String(chatId)}/leaderboards/${String(season.year)}`;

  return season.month === undefined
    ? base
    : `${base}/${String(season.month).padStart(2, "0")}`;
}
