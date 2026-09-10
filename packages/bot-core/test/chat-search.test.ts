import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { lookupSearch, searchReply } from "#src/chat/search.js";

const API_KEY = "test-exa-key";
const QUERY = "кинотеатры москва 12 сентября 2026 афиша";

const EXA_HIT = {
  highlights: ["Интерстеллар и Дюна в прокате на этой неделе"],
  title: "Афиша Москвы",
  url: "https://www.afisha.ru/msk/schedule_cinema/",
};

const searchServer = setupServer();

describe("search lookup", () => {
  beforeAll(() => {
    searchServer.listen({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    searchServer.resetHandlers();
  });

  afterAll(() => {
    searchServer.close();
  });

  it("returns titles, urls, and highlights from Exa", async () => {
    expect.hasAssertions();
    searchServer.use(
      http.post("https://api.exa.ai/search", () => HttpResponse.json({ results: [EXA_HIT] })),
    );

    await expect(lookupSearch({ apiKey: API_KEY, query: QUERY })).resolves.toStrictEqual({
      ok: true,
      results: [
        {
          highlights: ["Интерстеллар и Дюна в прокате на этой неделе"],
          title: "Афиша Москвы",
          url: "https://www.afisha.ru/msk/schedule_cinema/",
        },
      ],
    });
  });

  it("sends auto search with highlights and a 24h crawl cap", async () => {
    expect.hasAssertions();
    const requests: { body: unknown; key: string | null }[] = [];
    searchServer.use(
      http.post("https://api.exa.ai/search", async ({ request }) => {
        requests.push({
          body: await request.json(),
          key: request.headers.get("x-api-key"),
        });
        return HttpResponse.json({ results: [EXA_HIT] });
      }),
    );

    await lookupSearch({ apiKey: API_KEY, query: QUERY });

    expect(requests).toStrictEqual([
      {
        body: {
          contents: { highlights: true, maxAgeHours: 24 },
          query: QUERY,
          type: "auto",
        },
        key: API_KEY,
      },
    ]);
  });

  it("returns a miss when the API key is missing", async () => {
    expect.hasAssertions();
    await expect(lookupSearch({ apiKey: undefined, query: QUERY })).resolves.toStrictEqual({
      error: "поиск недоступен",
      ok: false,
    });
  });

  it("returns a miss when Exa is down", async () => {
    expect.hasAssertions();
    searchServer.use(
      http.post("https://api.exa.ai/search", () =>
        HttpResponse.json({ error: "unavailable" }, { status: 500 }),
      ),
    );

    await expect(lookupSearch({ apiKey: API_KEY, query: QUERY })).resolves.toStrictEqual({
      error: "поиск недоступен",
      ok: false,
    });
  });

  it("returns a miss when Exa finds no pages", async () => {
    expect.hasAssertions();
    searchServer.use(
      http.post("https://api.exa.ai/search", () => HttpResponse.json({ results: [] })),
    );

    await expect(lookupSearch({ apiKey: API_KEY, query: QUERY })).resolves.toStrictEqual({
      error: "ничего не нашлось",
      ok: false,
    });
  });
});

describe("search reply", () => {
  it("appends the top three titled links after the recap", () => {
    expect.hasAssertions();
    const reply = searchReply("интерстеллар и дюна в прокате", [
      {
        highlights: ["a"],
        title: "Афиша",
        url: "https://www.afisha.ru/msk/schedule_cinema/",
      },
      {
        highlights: ["b"],
        title: "Кинопоиск",
        url: "https://www.kinopoisk.ru/lists/movies/now/",
      },
      {
        highlights: ["c"],
        title: "Яндекс Афиша",
        url: "https://afisha.yandex.ru/moscow/cinema",
      },
      {
        highlights: ["d"],
        title: "ignored",
        url: "https://example.com/ignored",
      },
    ]);

    expect(reply).toStrictEqual({
      entities: [
        {
          length: 5,
          offset: 38,
          type: "text_link",
          url: "https://www.afisha.ru/msk/schedule_cinema/",
        },
        {
          length: 9,
          offset: 44,
          type: "text_link",
          url: "https://www.kinopoisk.ru/lists/movies/now/",
        },
        {
          length: 12,
          offset: 54,
          type: "text_link",
          url: "https://afisha.yandex.ru/moscow/cinema",
        },
      ],
      linkPreviewDisabled: true,
      text: "интерстеллар и дюна в прокате\nссылки: Афиша Кинопоиск Яндекс Афиша",
    });
  });

  it("uses the hostname when a hit has no title", () => {
    expect.hasAssertions();
    const reply = searchReply("че", [
      { highlights: [], title: "", url: "https://www.afisha.ru/msk/schedule_cinema/" },
    ]);

    expect(reply).toStrictEqual({
      entities: [
        {
          length: 13,
          offset: 11,
          type: "text_link",
          url: "https://www.afisha.ru/msk/schedule_cinema/",
        },
      ],
      linkPreviewDisabled: true,
      text: "че\nссылки: www.afisha.ru",
    });
  });

  it("returns null when there are no hits", () => {
    expect.hasAssertions();
    expect(searchReply("че", [])).toBeNull();
  });
});
