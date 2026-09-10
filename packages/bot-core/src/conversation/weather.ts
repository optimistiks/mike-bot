import type { Tool } from "ai";

import { tool } from "ai";
import { z } from "zod";

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const MOSCOW_TIME_ZONE = "Europe/Moscow";
const GEOCODE_COUNT = 10;
const DATE_TOKEN = /^\d{4}-\d{2}-\d{2}$/u;
const TENTHS = 10;

const WMO_CONDITION: Record<number, string> = {
  0: "ясно",
  1: "почти ясно",
  2: "переменная облачность",
  3: "пасмурно",
  45: "туман",
  48: "туман",
  51: "морось",
  53: "морось",
  55: "морось",
  56: "ледяная морось",
  57: "ледяная морось",
  61: "дождь",
  63: "дождь",
  65: "сильный дождь",
  66: "ледяной дождь",
  67: "ледяной дождь",
  71: "снег",
  73: "снег",
  75: "сильный снег",
  77: "снежная крупа",
  80: "ливень",
  81: "ливень",
  82: "ливень",
  85: "снег",
  86: "снег",
  95: "гроза",
  96: "гроза",
  99: "гроза",
};

const geocodeHitSchema = z.object({
  country: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  name: z.string(),
  population: z.number().optional(),
  timezone: z.string().optional(),
});

const geocodeResponseSchema = z.object({
  results: z.array(geocodeHitSchema).optional(),
});

const dailyForecastSchema = z.object({
  precipitation_sum: z.array(z.number()),
  temperature_2m_max: z.array(z.number()),
  temperature_2m_min: z.array(z.number()),
  time: z.array(z.string()),
  weather_code: z.array(z.number()),
});

const forecastResponseSchema = z.object({
  daily: dailyForecastSchema,
});

interface WeatherHit {
  condition: string;
  date: string;
  ok: true;
  place: string;
  precipitationMm: number;
  temperatureMaxC: number;
  temperatureMinC: number;
}

interface WeatherMiss {
  error: string;
  ok: false;
}

type WeatherLookup = WeatherHit | WeatherMiss;

interface LookupWeatherInput {
  date?: string;
  location: string;
  now: Date;
  signal?: AbortSignal;
}

type GeocodeHit = z.infer<typeof geocodeHitSchema>;

interface DailySnapshot {
  condition: string;
  precipitationMm: number;
  temperatureMaxC: number;
  temperatureMinC: number;
}

type JsonRead = { data: unknown; ok: true } | WeatherMiss;

function fail(error: string): WeatherMiss {
  return { error, ok: false };
}

function roundTenths(value: number): number {
  return Math.round(value * TENTHS) / TENTHS;
}

function calendarDateInMoscow(at: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: MOSCOW_TIME_ZONE,
    year: "numeric",
  }).formatToParts(at);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (year === undefined || month === undefined || day === undefined) {
    return "";
  }
  return `${year}-${month}-${day}`;
}

function resolveDate(date: string | undefined, now: Date): string | null {
  if (date === undefined || date === "") {
    const today = calendarDateInMoscow(now);
    return today === "" ? null : today;
  }
  if (!DATE_TOKEN.test(date)) {
    return null;
  }
  return date;
}

function placeLabel(hit: GeocodeHit): string {
  if (hit.country === undefined || hit.country === "") {
    return hit.name;
  }
  return `${hit.name}, ${hit.country}`;
}

function densestHit(results: GeocodeHit[]): GeocodeHit | undefined {
  const [first, ...rest] = results;
  if (first === undefined) {
    return undefined;
  }
  let best = first;
  for (const result of rest) {
    if ((result.population ?? 0) > (best.population ?? 0)) {
      best = result;
    }
  }
  return best;
}

async function readJson(url: URL, signal: AbortSignal | undefined): Promise<JsonRead> {
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      return fail("погода недоступна");
    }
    return { data: await response.json(), ok: true };
  } catch {
    return fail("погода недоступна");
  }
}

function geocodeUrl(location: string): URL {
  const url = new URL(GEOCODE_URL);
  url.searchParams.set("count", String(GEOCODE_COUNT));
  url.searchParams.set("language", "ru");
  url.searchParams.set("name", location);
  return url;
}

function forecastUrl(hit: GeocodeHit, date: string): URL {
  const url = new URL(FORECAST_URL);
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum",
  );
  url.searchParams.set("end_date", date);
  url.searchParams.set("latitude", String(hit.latitude));
  url.searchParams.set("longitude", String(hit.longitude));
  url.searchParams.set("start_date", date);
  url.searchParams.set("timezone", hit.timezone ?? MOSCOW_TIME_ZONE);
  return url;
}

async function geocodePlace(
  location: string,
  signal: AbortSignal | undefined,
): Promise<{ hit: GeocodeHit; ok: true } | WeatherMiss> {
  const read = await readJson(geocodeUrl(location), signal);
  if (!read.ok) {
    return read;
  }
  const parsed = geocodeResponseSchema.safeParse(read.data);
  if (!parsed.success) {
    return fail("место не найдено");
  }
  const hit = densestHit(parsed.data.results ?? []);
  if (hit === undefined) {
    return fail("место не найдено");
  }
  return { hit, ok: true };
}

function dailyAt(daily: z.infer<typeof dailyForecastSchema>, date: string): DailySnapshot | null {
  const index = daily.time.indexOf(date);
  if (index === -1) {
    return null;
  }
  const weatherCode = daily.weather_code[index];
  const temperatureMaxC = daily.temperature_2m_max[index];
  const temperatureMinC = daily.temperature_2m_min[index];
  const precipitationMm = daily.precipitation_sum[index];
  if (
    weatherCode === undefined ||
    temperatureMaxC === undefined ||
    temperatureMinC === undefined ||
    precipitationMm === undefined
  ) {
    return null;
  }
  return {
    condition: WMO_CONDITION[weatherCode] ?? "неясно",
    precipitationMm: roundTenths(precipitationMm),
    temperatureMaxC: roundTenths(temperatureMaxC),
    temperatureMinC: roundTenths(temperatureMinC),
  };
}

async function readForecast(
  hit: GeocodeHit,
  date: string,
  signal: AbortSignal | undefined,
): Promise<WeatherLookup> {
  const read = await readJson(forecastUrl(hit, date), signal);
  if (!read.ok) {
    return read;
  }
  const parsed = forecastResponseSchema.safeParse(read.data);
  if (!parsed.success) {
    return fail("погода недоступна");
  }
  const day = dailyAt(parsed.data.daily, date);
  if (day === null) {
    return fail("нет прогноза на эту дату");
  }
  return { date, ok: true, place: placeLabel(hit), ...day };
}

async function lookupWeather(input: LookupWeatherInput): Promise<WeatherLookup> {
  const date = resolveDate(input.date, input.now);
  if (date === null) {
    return fail("некорректная дата");
  }
  const place = await geocodePlace(input.location, input.signal);
  if (!place.ok) {
    return place;
  }
  return readForecast(place.hit, date, input.signal);
}

const weatherInputSchema = z.object({
  date: z
    .string()
    .optional()
    .describe("YYYY-MM-DD. Завтра это сегодня плюс один календарный день."),
  location: z.string().describe("Официальное название города; преобразуй сленг (мск это Москва)"),
});

function weatherTool(now: Date): Tool {
  const today = calendarDateInMoscow(now);
  return tool({
    description: [
      "Погода на указанный день.",
      `Сегодняшняя дата ${today}, часовой пояс Europe/Moscow.`,
      "Передавай официальное название города, а не сленг: мск это Москва, спб это Санкт-Петербург.",
      "Дата в формате YYYY-MM-DD; завтра это сегодня плюс один календарный день.",
      "Если дата не указана, используй сегодняшнюю.",
    ].join(" "),
    execute: ({ date, location }, { abortSignal }) =>
      lookupWeather({ date, location, now, signal: abortSignal }),
    inputSchema: weatherInputSchema,
  });
}

export type { LookupWeatherInput, WeatherLookup };
export { lookupWeather, weatherTool };
