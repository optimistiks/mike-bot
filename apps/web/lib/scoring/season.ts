/** Season = calendar month in Europe/Moscow (CONTEXT.md). */
export interface Season {
  year: number;
  month: number;
}

export const SEASON_TIMEZONE = "Europe/Moscow";
export const MOSCOW_UTC_OFFSET_HOURS = 3;
export const SEASON_GRACE_PERIOD_MS = 10 * 60 * 1000;

function readMoscowParts(date: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SEASON_TIMEZONE,
    year: "numeric",
    month: "numeric",
  }).formatToParts(date);

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);

  return { year, month };
}

export function seasonForDate(date: Date): Season {
  return readMoscowParts(date);
}

export function getCurrentSeason(now = new Date()): Season {
  return seasonForDate(now);
}

export function creditedSeasonForReaction(
  messageDate: Date,
  actionDate: Date,
): Season | null {
  const season = seasonForDate(messageDate);
  const { end } = seasonDateRange(season);
  const closesAt = end.getTime() + SEASON_GRACE_PERIOD_MS;

  return actionDate.getTime() < closesAt ? season : null;
}

export function seasonsEqual(left: Season, right: Season): boolean {
  return left.year === right.year && left.month === right.month;
}

export function seasonDateRange(season: Season): {
  start: Date;
  end: Date;
} {
  return {
    start: new Date(
      Date.UTC(season.year, season.month - 1, 1, -MOSCOW_UTC_OFFSET_HOURS),
    ),
    end: new Date(
      Date.UTC(season.year, season.month, 1, -MOSCOW_UTC_OFFSET_HOURS),
    ),
  };
}

export function formatSeasonLabel(season: Season): string {
  return `${String(season.year)}-${String(season.month).padStart(2, "0")}`;
}
