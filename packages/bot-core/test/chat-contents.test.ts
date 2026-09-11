import { captureException } from "@sentry/core";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { lookupContents } from "#src/chat/contents.js";

vi.mock(import("@sentry/core"), { spy: true });

const API_KEY = "test-exa-key";
const PAGE_URL = "https://example.com/article";
const SECOND_URL = "https://example.com/other";
const THIRD_URL = "https://example.com/third";
const FOURTH_URL = "https://example.com/fourth";

const EXA_PAGE = {
  text: "Команда выпустила новую версию",
  title: "Релиз",
  url: PAGE_URL,
};

const contentsServer = setupServer();

describe("contents lookup", () => {
  beforeAll(() => {
    contentsServer.listen({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    contentsServer.resetHandlers();
    vi.mocked(captureException).mockClear();
  });

  afterAll(() => {
    contentsServer.close();
  });

  it("returns title, url, and text from Exa", async () => {
    expect.hasAssertions();
    contentsServer.use(
      http.post("https://api.exa.ai/contents", () =>
        HttpResponse.json({
          results: [EXA_PAGE],
          statuses: [{ id: PAGE_URL, status: "success" }],
        }),
      ),
    );

    await expect(lookupContents({ apiKey: API_KEY, urls: [PAGE_URL] })).resolves.toStrictEqual({
      ok: true,
      results: [
        {
          text: "Команда выпустила новую версию",
          title: "Релиз",
          url: PAGE_URL,
        },
      ],
    });
  });

  it("sends known urls with top-level text extraction", async () => {
    expect.hasAssertions();
    const requests: { body: unknown; key: string | null }[] = [];
    contentsServer.use(
      http.post("https://api.exa.ai/contents", async ({ request }) => {
        requests.push({
          body: await request.json(),
          key: request.headers.get("x-api-key"),
        });
        return HttpResponse.json({
          results: [EXA_PAGE],
          statuses: [{ id: PAGE_URL, status: "success" }],
        });
      }),
    );

    await lookupContents({ apiKey: API_KEY, urls: [PAGE_URL, "ftp://example.com/a", PAGE_URL] });

    expect(requests).toStrictEqual([
      {
        body: { text: true, urls: [PAGE_URL] },
        key: API_KEY,
      },
    ]);
  });

  it("keeps at most three http urls and skips later ones", async () => {
    expect.hasAssertions();
    const requests: unknown[] = [];
    contentsServer.use(
      http.post("https://api.exa.ai/contents", async ({ request }) => {
        requests.push(await request.json());
        return HttpResponse.json({
          results: [
            { text: "a", title: "A", url: PAGE_URL },
            { text: "b", title: "B", url: SECOND_URL },
            { text: "c", title: "C", url: THIRD_URL },
          ],
          statuses: [
            { id: PAGE_URL, status: "success" },
            { id: SECOND_URL, status: "success" },
            { id: THIRD_URL, status: "success" },
          ],
        });
      }),
    );

    await lookupContents({
      apiKey: API_KEY,
      urls: [PAGE_URL, SECOND_URL, THIRD_URL, FOURTH_URL],
    });

    expect(requests).toStrictEqual([{ text: true, urls: [PAGE_URL, SECOND_URL, THIRD_URL] }]);
  });

  it("returns a miss when the API key is missing", async () => {
    expect.hasAssertions();
    await expect(lookupContents({ apiKey: undefined, urls: [PAGE_URL] })).resolves.toStrictEqual({
      error: "страница недоступна",
      ok: false,
    });
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: "contents config" }),
      expect.objectContaining({ tags: { tool: "contents", tool_failure: "config" } }),
    );
  });

  it("returns a miss when Exa is down", async () => {
    expect.hasAssertions();
    contentsServer.use(
      http.post("https://api.exa.ai/contents", () =>
        HttpResponse.json({ error: "unavailable" }, { status: 500 }),
      ),
    );

    await expect(lookupContents({ apiKey: API_KEY, urls: [PAGE_URL] })).resolves.toStrictEqual({
      error: "страница недоступна",
      ok: false,
    });
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: "contents http 500" }),
      expect.objectContaining({ tags: { tool: "contents", tool_failure: "http" } }),
    );
  });

  it("returns a miss when every requested url fails", async () => {
    expect.hasAssertions();
    contentsServer.use(
      http.post("https://api.exa.ai/contents", () =>
        HttpResponse.json({
          results: [],
          statuses: [{ id: PAGE_URL, status: "error" }],
        }),
      ),
    );

    await expect(lookupContents({ apiKey: API_KEY, urls: [PAGE_URL] })).resolves.toStrictEqual({
      error: "ничего не нашлось",
      ok: false,
    });
    expect(captureException).not.toHaveBeenCalled();
  });

  it("returns a miss when no http urls remain", async () => {
    expect.hasAssertions();
    await expect(
      lookupContents({ apiKey: API_KEY, urls: ["ftp://example.com/a", "not-a-url"] }),
    ).resolves.toStrictEqual({
      error: "страница недоступна",
      ok: false,
    });
    expect(captureException).not.toHaveBeenCalled();
  });

  it("reports a network failure when fetch throws", async () => {
    expect.hasAssertions();
    contentsServer.use(http.post("https://api.exa.ai/contents", () => HttpResponse.error()));

    await expect(lookupContents({ apiKey: API_KEY, urls: [PAGE_URL] })).resolves.toStrictEqual({
      error: "страница недоступна",
      ok: false,
    });
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: "contents network" }),
      expect.objectContaining({ tags: { tool: "contents", tool_failure: "network" } }),
    );
  });

  it("reports a parse failure when the body is not JSON", async () => {
    expect.hasAssertions();
    contentsServer.use(
      http.post("https://api.exa.ai/contents", () =>
        HttpResponse.text("not json", { status: 200 }),
      ),
    );

    await expect(lookupContents({ apiKey: API_KEY, urls: [PAGE_URL] })).resolves.toStrictEqual({
      error: "страница недоступна",
      ok: false,
    });
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: "contents parse" }),
      expect.objectContaining({ tags: { tool: "contents", tool_failure: "parse" } }),
    );
  });

  it("reports a parse failure when the body fails the schema", async () => {
    expect.hasAssertions();
    contentsServer.use(
      http.post("https://api.exa.ai/contents", () => HttpResponse.json({ results: [{}] })),
    );

    await expect(lookupContents({ apiKey: API_KEY, urls: [PAGE_URL] })).resolves.toStrictEqual({
      error: "страница недоступна",
      ok: false,
    });
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: "contents parse" }),
      expect.objectContaining({ tags: { tool: "contents", tool_failure: "parse" } }),
    );
  });

  it("does not report an aborted fetch", async () => {
    expect.hasAssertions();
    const controller = new AbortController();
    controller.abort();

    await expect(
      lookupContents({ apiKey: API_KEY, signal: controller.signal, urls: [PAGE_URL] }),
    ).resolves.toStrictEqual({
      error: "страница недоступна",
      ok: false,
    });
    expect(captureException).not.toHaveBeenCalled();
  });
});
