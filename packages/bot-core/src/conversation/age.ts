import { EMPTY_COUNT, MS_PER_SECOND } from "#src/constants.js";

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
  if (deltaSeconds < EMPTY_COUNT) {
    return EMPTY_COUNT;
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

function absolutePostedAtLabel(postedAt: Date): string {
  return postedAt.toISOString().replace(ISO_FRACTIONAL_SECONDS, "Z");
}

export { absolutePostedAtLabel, relativePastLabel };
