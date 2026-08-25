import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  chatPhotoOptions,
  chatsOptions,
  leaderboardOptions,
  periodsOptions,
  retryApiRequest,
  saveScoringReactions,
} from "./queries";
import type { TelegramPlatform } from "./telegram-platform";

const CHAT_ID = -100_456;

function platformFor(memberId: number): TelegramPlatform {
  return {
    initDataRaw: `init-data-for-${String(memberId)}`,
    memberId,
    supportsNativeBackButton: true,
    impact: vi.fn(),
    selection: vi.fn(),
    notificationSuccess: vi.fn(),
    ready: vi.fn(),
    setBackButton: vi.fn(() => () => undefined),
  };
}

const member = platformFor(101);
const otherMember = platformFor(202);

function stubJsonFetch(body: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(body));
}

/** Run a query's fetcher directly; nothing here needs a QueryClient. */
async function runQuery(options: { queryFn?: unknown }): Promise<unknown> {
  const { queryFn } = options;
  if (typeof queryFn !== "function") throw new Error("options have no queryFn");
  return (queryFn as () => Promise<unknown>)();
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("query cache partitioning", () => {
  // Chat-scoped access is authorised per Member (ADR-0009), so nothing cached
  // for one Member may ever be served to another inside the same client.
  it.each([
    ["chats", (platform: TelegramPlatform) => chatsOptions(platform)],
    [
      "periods",
      (platform: TelegramPlatform) => periodsOptions(platform, CHAT_ID),
    ],
    [
      "leaderboard",
      (platform: TelegramPlatform) =>
        leaderboardOptions(platform, CHAT_ID, {
          kind: "season",
          year: 2026,
          month: 8,
        }),
    ],
    [
      "photo",
      (platform: TelegramPlatform) =>
        chatPhotoOptions(platform, CHAT_ID, "photo-version-1"),
    ],
  ])("keys %s by the authenticated Member", (_name, build) => {
    const key = build(member).queryKey;

    expect(key.slice(0, 2)).toEqual(["member", 101]);
    expect(key).not.toEqual(build(otherMember).queryKey);
  });

  it("separates Chats within one Member", () => {
    expect(periodsOptions(member, CHAT_ID).queryKey).not.toEqual(
      periodsOptions(member, -100_999).queryKey,
    );
  });

  it("separates Leaderboard periods within one Chat", () => {
    const season = leaderboardOptions(member, CHAT_ID, {
      kind: "season",
      year: 2026,
      month: 8,
    }).queryKey;
    const year = leaderboardOptions(member, CHAT_ID, {
      kind: "year",
      year: 2026,
    }).queryKey;

    expect(season).not.toEqual(year);
  });
});

describe("authenticated requests", () => {
  it("signs every read with the Member's init data", async () => {
    const fetchSpy = stubJsonFetch({ chats: [] });

    await runQuery(chatsOptions(member));

    expect(fetchSpy.mock.calls[0]?.[0]).toBe("/api/chats");
    // Asserted through `Headers` rather than as an object literal: what matters
    // is the header the request carries, not the shape handed to `fetch`.
    expect(
      new Headers(fetchSpy.mock.calls[0]?.[1]?.headers).get("Authorization"),
    ).toBe("tma init-data-for-101");
  });

  it("signs a save, and declares its body as JSON", async () => {
    const fetchSpy = stubJsonFetch({
      reactions: [],
      usingDefaults: false,
      canEdit: true,
    });

    await saveScoringReactions(member, CHAT_ID, {
      bindings: { "humor.add": ["emoji:🤡"] },
    });

    const [path, init] = fetchSpy.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);

    expect(path).toBe(`/api/chats/${String(CHAT_ID)}/scoring-reactions`);
    expect(init?.method).toBe("PUT");
    expect(headers.get("Authorization")).toBe("tma init-data-for-101");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(init?.body).toBe(
      JSON.stringify({ bindings: { "humor.add": ["emoji:🤡"] } }),
    );
  });

  it("asks for a Season by year and month", async () => {
    const fetchSpy = stubJsonFetch({
      chatId: CHAT_ID,
      period: { kind: "season", year: 2026, month: 8 },
      sections: [],
    });

    await runQuery(
      leaderboardOptions(member, CHAT_ID, {
        kind: "season",
        year: 2026,
        month: 8,
      }),
    );

    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      "/api/leaderboard?chat_id=-100456&year=2026&month=8",
    );
  });

  it("asks for annual totals by year alone", async () => {
    const fetchSpy = stubJsonFetch({
      chatId: CHAT_ID,
      period: { kind: "year", year: 2026 },
      sections: [],
    });

    await runQuery(
      leaderboardOptions(member, CHAT_ID, { kind: "year", year: 2026 }),
    );

    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      "/api/leaderboard?chat_id=-100456&year=2026",
    );
  });

  it("reports the status of a refused request", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 403 }),
    );

    await expect(runQuery(chatsOptions(member))).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe("retryApiRequest", () => {
  it.each([400, 401, 403, 404])(
    "never retries %i, which retrying cannot fix",
    (status) => {
      expect(retryApiRequest(0, new ApiError(status))).toBe(false);
    },
  );

  it("retries a server error twice and then gives up", () => {
    expect(retryApiRequest(0, new ApiError(500))).toBe(true);
    expect(retryApiRequest(1, new ApiError(500))).toBe(true);
    expect(retryApiRequest(2, new ApiError(500))).toBe(false);
  });

  it("retries an ordinary network failure", () => {
    expect(retryApiRequest(0, new TypeError("Failed to fetch"))).toBe(true);
  });
});
