import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getRuntimeDb, resetRuntimeDbForTests } from "@/lib/db/runtime";
import { chats, registrations } from "@/lib/db/schema";
import { signedTmaAuthorization, TEST_BOT_TOKEN } from "@/test/tma-init-data";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({ getFile: vi.fn(), getChat: vi.fn() }));

vi.mock("grammy", () => ({
  Api: class {
    getFile = mocks.getFile;
    getChat = mocks.getChat;
  },
}));

const CHAT_ID = -100_555_111;
const MEMBER_ID = 4242;
const PHOTO_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function photoRequest(
  chatId: number = CHAT_ID,
  authorization: string | null = signedTmaAuthorization(MEMBER_ID),
): [Request, { params: Promise<{ chatId: string }> }] {
  return [
    new Request(`http://localhost/api/chats/${String(chatId)}/photo`, {
      headers: authorization ? { authorization } : {},
    }),
    { params: Promise.resolve({ chatId: String(chatId) }) },
  ];
}

async function seedChat(photoSmallFileId: string | null): Promise<void> {
  const db = await getRuntimeDb();
  await db.insert(chats).values({
    chatId: CHAT_ID,
    title: "Клуб пятничных созвонов",
    photoSmallFileId,
    photoUniqueId: photoSmallFileId === null ? null : "unique-1",
    metadataCheckedAt: new Date(),
  });
}

async function register(userId: number): Promise<void> {
  const db = await getRuntimeDb();
  await db.insert(registrations).values({ chatId: CHAT_ID, userId });
}

describe("GET /api/chats/[chatId]/photo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BOT_TOKEN = TEST_BOT_TOKEN;
    mocks.getFile.mockResolvedValue({ file_path: "photos/file_1.jpg" });
    mocks.getChat.mockRejectedValue(new Error("network unavailable"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    delete process.env.BOT_TOKEN;
    await resetRuntimeDbForTests();
  });

  it("refuses a Member without Registration in that Chat", async () => {
    await seedChat("small-file-1");

    const response = await GET(...photoRequest());

    expect(response.status).toBe(403);
    expect(mocks.getFile).not.toHaveBeenCalled();
  });

  it("streams the photo to a registered Member without exposing the bot token", async () => {
    await seedChat("small-file-1");
    await register(MEMBER_ID);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(PHOTO_BYTES, {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      }),
    );

    const response = await GET(...photoRequest());
    const body = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(body).toEqual(PHOTO_BYTES);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toBe("private, max-age=3600");

    // The token is what lets anyone read the file straight from Telegram, so it
    // must stay on this side of the proxy.
    const exposed = [...response.headers.entries()].flat().join("\n");
    expect(exposed).not.toContain(TEST_BOT_TOKEN);
    expect(fetchSpy.mock.calls[0]?.[0]).toContain(TEST_BOT_TOKEN);
  });

  it("reports 404 for a Chat that has no photo", async () => {
    await seedChat(null);
    await register(MEMBER_ID);

    const response = await GET(...photoRequest());

    expect(response.status).toBe(404);
    expect(mocks.getFile).not.toHaveBeenCalled();
  });

  it("reports 404 when Telegram will not serve the file", async () => {
    await seedChat("small-file-1");
    await register(MEMBER_ID);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 404 }),
    );

    const response = await GET(...photoRequest());

    expect(response.status).toBe(404);
  });
});
