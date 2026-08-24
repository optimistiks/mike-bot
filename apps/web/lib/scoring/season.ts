/** Season = calendar month in Europe/Moscow (CONTEXT.md). */
export interface Season {
  year: number;
  month: number;
}

export const SEASON_TIMEZONE = "Europe/Moscow";
export const MOSCOW_UTC_OFFSET_HOURS = 3;
export const SEASON_GRACE_PERIOD_MS = 10 * 60 * 1000;

/**
 * How long after adding a Scoring reaction the Actor may remove it to take the
 * Mark back. Measured against Telegram's own timestamps, like Season
 * eligibility above, never against bot processing time (ADR-0003, ADR-0015).
 */
export const MARK_UNDO_WINDOW_MS = 5 * 1000;

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

/**
 * Whether a Scoring action is still in time to place a Mark on this Message.
 *
 * A write-time gate, and the only place the grace period is applied. Where a
 * Mark is *credited* is a separate question with a separate answer — the Season
 * of the Message's post time — so nothing on the read path consults this.
 */
export function isSeasonOpenForAction(
  messageDate: Date,
  actionDate: Date,
): boolean {
  const { end } = seasonDateRange(seasonForDate(messageDate));

  return actionDate.getTime() < end.getTime() + SEASON_GRACE_PERIOD_MS;
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

/** A Season's bounds as Telegram-style epoch seconds, for message-date queries. */
export function seasonDateRangeInSeconds(season: Season): {
  start: number;
  end: number;
} {
  const { start, end } = seasonDateRange(season);

  return {
    start: Math.floor(start.getTime() / 1000),
    end: Math.floor(end.getTime() / 1000),
  };
}

export function formatSeasonLabel(season: Season): string {
  return `${String(season.year)}-${String(season.month).padStart(2, "0")}`;
}
