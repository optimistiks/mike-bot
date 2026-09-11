import { captureException } from "@sentry/core";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { lookupWeather } from "#src/chat/weather.js";

vi.mock(import("@sentry/core"), { spy: true });

const NOW = new Date("2026-09-10T12:00:00.000Z");
const MOSCOW_DATE = "2026-09-11";

const MOSCOW_GEOCODE = {
  results: [
    {
      country: "Россия",
      latitude: 55.75204,
      longitude: 37.61781,
      name: "Москва",
      population: 10_381_222,
      timezone: "Europe/Moscow",
    },
  ],
};

const MOSCOW_FORECAST = {
  daily: {
    precipitation_sum: [9.7],
    temperature_2m_max: [16.8],
    temperature_2m_min: [10.3],
    time: [MOSCOW_DATE],
    weather_code: [80],
  },
};

const weatherServer = setupServer();

describe("weather lookup", () => {
  beforeAll(() => {
    weatherServer.listen({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    weatherServer.resetHandlers();
    vi.mocked(captureException).mockClear();
  });

  afterAll(() => {
    weatherServer.close();
  });

  it("returns the daily forecast for a named city and date", async () => {
    expect.hasAssertions();
    weatherServer.use(
      http.get("https://geocoding-api.open-meteo.com/v1/search", () =>
        HttpResponse.json(MOSCOW_GEOCODE),
      ),
      http.get("https://api.open-meteo.com/v1/forecast", () => HttpResponse.json(MOSCOW_FORECAST)),
    );

    await expect(
      lookupWeather({ date: MOSCOW_DATE, location: "Москва", now: NOW }),
    ).resolves.toStrictEqual({
      condition: "ливень",
      date: MOSCOW_DATE,
      ok: true,
      place: "Москва, Россия",
      precipitationMm: 9.7,
      temperatureMaxC: 16.8,
      temperatureMinC: 10.3,
    });
  });

  it("returns a miss when geocoding finds no place", async () => {
    expect.hasAssertions();
    weatherServer.use(
      http.get("https://geocoding-api.open-meteo.com/v1/search", () =>
        HttpResponse.json({ generationtime_ms: 0.4 }),
      ),
    );

    await expect(
      lookupWeather({ date: MOSCOW_DATE, location: "мск", now: NOW }),
    ).resolves.toStrictEqual({ error: "место не найдено", ok: false });
    expect(captureException).not.toHaveBeenCalled();
  });

  it("picks the geocode hit with the highest population", async () => {
    expect.hasAssertions();
    weatherServer.use(
      http.get("https://geocoding-api.open-meteo.com/v1/search", () =>
        HttpResponse.json({
          results: [
            {
              country: "США",
              latitude: 46.73,
              longitude: -117,
              name: "Москва",
              population: 25_060,
              timezone: "America/Los_Angeles",
            },
            {
              country: "Россия",
              latitude: 55.75204,
              longitude: 37.61781,
              name: "Москва",
              population: 10_381_222,
              timezone: "Europe/Moscow",
            },
          ],
        }),
      ),
      http.get("https://api.open-meteo.com/v1/forecast", () => HttpResponse.json(MOSCOW_FORECAST)),
    );

    await expect(
      lookupWeather({ date: MOSCOW_DATE, location: "Moscow", now: NOW }),
    ).resolves.toMatchObject({ ok: true, place: "Москва, Россия" });
  });

  it("defaults a missing date to today in Europe/Moscow", async () => {
    expect.hasAssertions();
    const requestedDates: string[] = [];
    weatherServer.use(
      http.get("https://geocoding-api.open-meteo.com/v1/search", () =>
        HttpResponse.json(MOSCOW_GEOCODE),
      ),
      http.get("https://api.open-meteo.com/v1/forecast", ({ request }) => {
        requestedDates.push(String(new URL(request.url).searchParams.get("start_date")));
        return HttpResponse.json({
          daily: {
            precipitation_sum: [0],
            temperature_2m_max: [24.9],
            temperature_2m_min: [11],
            time: ["2026-09-10"],
            weather_code: [3],
          },
        });
      }),
    );

    await expect(lookupWeather({ location: "Москва", now: NOW })).resolves.toStrictEqual({
      condition: "пасмурно",
      date: "2026-09-10",
      ok: true,
      place: "Москва, Россия",
      precipitationMm: 0,
      temperatureMaxC: 24.9,
      temperatureMinC: 11,
    });
    expect(requestedDates).toStrictEqual(["2026-09-10"]);
  });

  it("uses the next Moscow calendar day after 21:00 UTC", async () => {
    expect.hasAssertions();
    const requestedDates: string[] = [];
    weatherServer.use(
      http.get("https://geocoding-api.open-meteo.com/v1/search", () =>
        HttpResponse.json(MOSCOW_GEOCODE),
      ),
      http.get("https://api.open-meteo.com/v1/forecast", ({ request }) => {
        requestedDates.push(String(new URL(request.url).searchParams.get("start_date")));
        return HttpResponse.json(MOSCOW_FORECAST);
      }),
    );

    await expect(
      lookupWeather({ location: "Москва", now: new Date("2026-09-10T21:30:00.000Z") }),
    ).resolves.toMatchObject({ date: MOSCOW_DATE, ok: true });
    expect(requestedDates).toStrictEqual([MOSCOW_DATE]);
  });

  it("returns a miss when Open-Meteo is down", async () => {
    expect.hasAssertions();
    weatherServer.use(
      http.get("https://geocoding-api.open-meteo.com/v1/search", () =>
        HttpResponse.json({ error: "unavailable" }, { status: 500 }),
      ),
    );

    await expect(
      lookupWeather({ date: MOSCOW_DATE, location: "Москва", now: NOW }),
    ).resolves.toStrictEqual({ error: "погода недоступна", ok: false });
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: "weather http 500" }),
      expect.objectContaining({ tags: { tool: "weather", tool_failure: "http" } }),
    );
  });

  it("returns a miss when the forecast has no row for the date", async () => {
    expect.hasAssertions();
    weatherServer.use(
      http.get("https://geocoding-api.open-meteo.com/v1/search", () =>
        HttpResponse.json(MOSCOW_GEOCODE),
      ),
      http.get("https://api.open-meteo.com/v1/forecast", () =>
        HttpResponse.json({
          daily: {
            precipitation_sum: [0],
            temperature_2m_max: [20],
            temperature_2m_min: [10],
            time: ["2026-09-10"],
            weather_code: [0],
          },
        }),
      ),
    );

    await expect(
      lookupWeather({ date: MOSCOW_DATE, location: "Москва", now: NOW }),
    ).resolves.toStrictEqual({ error: "нет прогноза на эту дату", ok: false });
    expect(captureException).not.toHaveBeenCalled();
  });

  it("returns a miss when the date is not a calendar day", async () => {
    expect.hasAssertions();
    await expect(
      lookupWeather({ date: "завтра", location: "Москва", now: NOW }),
    ).resolves.toStrictEqual({ error: "некорректная дата", ok: false });
    expect(captureException).not.toHaveBeenCalled();
  });

  it("reports a network failure when fetch throws", async () => {
    expect.hasAssertions();
    weatherServer.use(
      http.get("https://geocoding-api.open-meteo.com/v1/search", () => HttpResponse.error()),
    );

    await expect(
      lookupWeather({ date: MOSCOW_DATE, location: "Москва", now: NOW }),
    ).resolves.toStrictEqual({ error: "погода недоступна", ok: false });
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: "weather network" }),
      expect.objectContaining({ tags: { tool: "weather", tool_failure: "network" } }),
    );
  });

  it("reports a parse failure when the body is not JSON", async () => {
    expect.hasAssertions();
    weatherServer.use(
      http.get("https://geocoding-api.open-meteo.com/v1/search", () =>
        HttpResponse.text("not json", { status: 200 }),
      ),
    );

    await expect(
      lookupWeather({ date: MOSCOW_DATE, location: "Москва", now: NOW }),
    ).resolves.toStrictEqual({ error: "погода недоступна", ok: false });
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: "weather parse" }),
      expect.objectContaining({ tags: { tool: "weather", tool_failure: "parse" } }),
    );
  });

  it("reports a parse failure when geocoding fails the schema", async () => {
    expect.hasAssertions();
    weatherServer.use(
      http.get("https://geocoding-api.open-meteo.com/v1/search", () =>
        HttpResponse.json({ results: [{}] }),
      ),
    );

    await expect(
      lookupWeather({ date: MOSCOW_DATE, location: "Москва", now: NOW }),
    ).resolves.toStrictEqual({ error: "место не найдено", ok: false });
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: "weather parse" }),
      expect.objectContaining({ tags: { tool: "weather", tool_failure: "parse" } }),
    );
  });

  it("reports a parse failure when the forecast fails the schema", async () => {
    expect.hasAssertions();
    weatherServer.use(
      http.get("https://geocoding-api.open-meteo.com/v1/search", () =>
        HttpResponse.json(MOSCOW_GEOCODE),
      ),
      http.get("https://api.open-meteo.com/v1/forecast", () => HttpResponse.json({ daily: {} })),
    );

    await expect(
      lookupWeather({ date: MOSCOW_DATE, location: "Москва", now: NOW }),
    ).resolves.toStrictEqual({ error: "погода недоступна", ok: false });
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: "weather parse" }),
      expect.objectContaining({ tags: { tool: "weather", tool_failure: "parse" } }),
    );
  });

  it("does not report an aborted fetch", async () => {
    expect.hasAssertions();
    const controller = new AbortController();
    controller.abort();

    await expect(
      lookupWeather({
        date: MOSCOW_DATE,
        location: "Москва",
        now: NOW,
        signal: controller.signal,
      }),
    ).resolves.toStrictEqual({ error: "погода недоступна", ok: false });
    expect(captureException).not.toHaveBeenCalled();
  });
});
