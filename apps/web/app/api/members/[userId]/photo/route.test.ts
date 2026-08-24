import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getRuntimeDb, resetRuntimeDbForTests } from "@/lib/db/runtime";
import { displayIdentities, registrations } from "@/lib/db/schema";
import { signedTmaAuthorization, TEST_BOT_TOKEN } from "@/test/tma-init-data";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getFile: vi.fn(),
  getUserProfilePhotos: vi.fn(),
}));

vi.mock("grammy", () => ({
  Api: class {
    getFile = mocks.getFile;
    getUserProfilePhotos = mocks.getUserProfilePhotos;
  },
}));

const CHAT_ID = -100_555_111;
const MEMBER_ID = 4242;
const SUBJECT_ID = 909;
const PHOTO_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function photoRequest(
  userId: number = SUBJECT_ID,
  authorization: string | null = signedTmaAuthorization(MEMBER_ID),
): [Request, { params: Promise<{ userId: string }> }] {
  return [
    new Request(`http://localhost/api/members/${String(userId)}/photo`, {
      headers: authorization ? { authorization } : {},
    }),
    { params: Promise.resolve({ userId: String(userId) }) },
  ];
}

async function seedSharedChat(): Promise<void> {
  const db = await getRuntimeDb();
  await db.insert(registrations).values({ chatId: CHAT_ID, userId: MEMBER_ID });
  await db.insert(displayIdentities).values({
    chatId: CHAT_ID,
    userId: SUBJECT_ID,
    displayName: "@subject_member",
  });
}

describe("GET /api/members/[userId]/photo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BOT_TOKEN = TEST_BOT_TOKEN;
    mocks.getFile.mockResolvedValue({ file_path: "photos/file_1.jpg" });
    mocks.getUserProfilePhotos.mockResolvedValue({
      total_count: 1,
      // Telegram returns the sizes ascending; the avatar wants the first.
      photos: [
        [
          { file_id: "small-file-1", width: 160, height: 160 },
          { file_id: "large-file-1", width: 640, height: 640 },
        ],
      ],
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    delete process.env.BOT_TOKEN;
    await resetRuntimeDbForTests();
  });

  it("refuses a Member who shares no Chat with the subject", async () => {
    const db = await getRuntimeDb();
    await db
      .insert(registrations)
      .values({ chatId: CHAT_ID, userId: MEMBER_ID });

    const response = await GET(...photoRequest());

    expect(response.status).toBe(403);
    expect(mocks.getUserProfilePhotos).not.toHaveBeenCalled();
  });

  it("streams the smallest photo without exposing the bot token", async () => {
    await seedSharedChat();
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
    expect(response.headers.get("cache-control")).toBe("private, max-age=3600");
    expect(mocks.getFile).toHaveBeenCalledWith("small-file-1");

    const exposed = [...response.headers.entries()].flat().join("\n");
    expect(exposed).not.toContain(TEST_BOT_TOKEN);
    expect(fetchSpy.mock.calls[0]?.[0]).toContain(TEST_BOT_TOKEN);
  });

  it("reports 404 for a Member with no profile photo", async () => {
    await seedSharedChat();
    mocks.getUserProfilePhotos.mockResolvedValue({
      total_count: 0,
      photos: [],
    });

    const response = await GET(...photoRequest());

    expect(response.status).toBe(404);
    expect(mocks.getFile).not.toHaveBeenCalled();
  });

  it("reports 404 when Telegram refuses the request", async () => {
    await seedSharedChat();
    mocks.getUserProfilePhotos.mockRejectedValue(new Error("forbidden"));

    const response = await GET(...photoRequest());

    expect(response.status).toBe(404);
  });
});
