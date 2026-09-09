const MOSCOW_TIME_ZONE = "Europe/Moscow";
const YEAR_TOKEN = /^[0-9]{4}$/u;

function calendarYearInMoscow(at: Date): number {
  const year = new Intl.DateTimeFormat("en-US", {
    timeZone: MOSCOW_TIME_ZONE,
    year: "numeric",
  })
    .formatToParts(at)
    .find((part) => part.type === "year")?.value;
  if (year === undefined) {
    throw new TypeError("Europe/Moscow calendar year is missing");
  }
  return Number(year);
}

function standingsYear(firstArg: string | undefined, at: Date): number | null {
  if (firstArg === undefined) {
    return calendarYearInMoscow(at);
  }
  if (!YEAR_TOKEN.test(firstArg)) {
    return null;
  }
  return Number(firstArg);
}

export { MOSCOW_TIME_ZONE, standingsYear };
