/** Season = calendar month in Europe/Moscow (CONTEXT.md). */
export interface Season {
  year: number;
  month: number;
}

export const SEASON_TIMEZONE = "Europe/Moscow";

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

export function isEventInSeason(createdAt: Date, season: Season): boolean {
  const eventSeason = seasonForDate(createdAt);
  return eventSeason.year === season.year && eventSeason.month === season.month;
}

export function formatSeasonLabel(season: Season): string {
  return `${String(season.year)}-${String(season.month).padStart(2, "0")}`;
}
