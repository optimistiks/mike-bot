const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

const RELATIVE_PAST = new Intl.RelativeTimeFormat("ru", { numeric: "always", style: "short" });

type AgeUnit = "second" | "minute" | "hour" | "day";

interface AgeParts {
  unit: AgeUnit;
  value: number;
}

function pastSecondsBetween(postedAt: Date, now: Date): number {
  const deltaSeconds = Math.floor((now.getTime() - postedAt.getTime()) / MS_PER_SECOND);
  if (deltaSeconds < 0) {
    return 0;
  }
  return deltaSeconds;
}

function hourParts(minutes: number): AgeParts {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) {
    return { unit: "hour", value: hours };
  }
  return { unit: "day", value: Math.floor(hours / HOURS_PER_DAY) };
}

function minuteParts(pastSeconds: number): AgeParts {
  const minutes = Math.floor(pastSeconds / SECONDS_PER_MINUTE);
  if (minutes < MINUTES_PER_HOUR) {
    return { unit: "minute", value: minutes };
  }
  return hourParts(minutes);
}

function ageParts(pastSeconds: number): AgeParts {
  if (pastSeconds < SECONDS_PER_MINUTE) {
    return { unit: "second", value: pastSeconds };
  }
  return minuteParts(pastSeconds);
}

function relativePastLabel(postedAt: Date, now: Date): string {
  const parts = ageParts(pastSecondsBetween(postedAt, now));
  return RELATIVE_PAST.format(-parts.value, parts.unit);
}

const ISO_FRACTIONAL_SECONDS = /\.\d{3}Z$/u;
const RELATIVE_AGE_BRACKET = /\[(?<value>\d+) (?<unit>сек\.|мин\.|ч|дн\.) назад\]/gu;

function absolutePostedAtLabel(postedAt: Date): string {
  return postedAt.toISOString().replace(ISO_FRACTIONAL_SECONDS, "Z");
}

function ageUnitMs(unit: string): number | undefined {
  if (unit === "сек.") {
    return MS_PER_SECOND;
  }
  if (unit === "мин.") {
    return MS_PER_SECOND * SECONDS_PER_MINUTE;
  }
  if (unit === "ч") {
    return MS_PER_SECOND * SECONDS_PER_MINUTE * MINUTES_PER_HOUR;
  }
  if (unit === "дн.") {
    return MS_PER_SECOND * SECONDS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY;
  }
  return undefined;
}

function stampRelativeAgeLabels(text: string, now: Date): string {
  RELATIVE_AGE_BRACKET.lastIndex = 0;
  return text.replaceAll(RELATIVE_AGE_BRACKET, (match: string, value: string, unit: string) => {
    const unitMs = ageUnitMs(unit);
    if (unitMs === undefined) {
      return match;
    }
    return `[${absolutePostedAtLabel(new Date(now.getTime() - Number(value) * unitMs))}]`;
  });
}

export { relativePastLabel, stampRelativeAgeLabels };
