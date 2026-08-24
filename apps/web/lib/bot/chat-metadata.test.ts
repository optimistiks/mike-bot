import type { Chat, ChatFullInfo } from "grammy/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPgliteDb } from "@/lib/db/pglite";
import type { AppDatabase } from "@/lib/db/runtime";

import {
  getStoredChatMetadata,
  resolveChatMetadata,
  upsertChatFromTelegramUpdate,
} from "./chat-metadata";

const mocks = vi.hoisted(() => ({ getChat: vi.fn() }));

vi.mock("grammy", () => ({
  Api: class {
    getChat = mocks.getChat;
  },
}));

const CHAT_ID = -100_777_222;
const BOT_TOKEN = "123:token";

const groupChat = { id: CHAT_ID, type: "supergroup", title: "Пятница" } as Chat;

function telegramChat(overrides: Partial<ChatFullInfo> = {}): ChatFullInfo {
  return {
    id: CHAT_ID,
    type: "supergroup",
    title: "Пятница",
    accent_color_id: 0,
    max_reaction_count: 11,
    ...overrides,
  } as ChatFullInfo;
}

describe("Chat metadata", () => {
  let db: AppDatabase;

  beforeEach(async () => {
    vi.clearAllMocks();
    // resolveChatMetadata treats stored metadata as permanently fresh under
    // NODE_ENV=test so unrelated suites never reach Telegram. Its real
    // staleness rule only exists outside that guard.
    vi.stubEnv("NODE_ENV", "development");
    const pglite = await createPgliteDb();
    db = pglite.db;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("upsertChatFromTelegramUpdate", () => {
    it("stores the Chat title from an ordinary group update", async () => {
      await upsertChatFromTelegramUpdate(db, groupChat);

      expect(await getStoredChatMetadata(db, CHAT_ID)).toMatchObject({
        chatId: CHAT_ID,
        title: "Пятница",
        photoSmallFileId: null,
      });
    });

    it("writes nothing when an update repeats what is already stored", async () => {
      // Every message, reaction and join carries the Chat, and an upsert locks
      // the row until the transaction commits — so rewriting an unchanged title
      // queues the whole Chat behind one row for nothing.
      await expect(upsertChatFromTelegramUpdate(db, groupChat)).resolves.toBe(
        "written",
      );
      await expect(upsertChatFromTelegramUpdate(db, groupChat)).resolves.toBe(
        "unchanged",
      );
    });

    it("mirrors a plain group", async () => {
      await upsertChatFromTelegramUpdate(db, {
        id: -444,
        type: "group",
        title: "Плейн",
      });

      expect(await getStoredChatMetadata(db, -444)).toMatchObject({
        title: "Плейн",
      });
    });

    it("ignores private chats", async () => {
      await upsertChatFromTelegramUpdate(db, {
        id: 555,
        type: "private",
        first_name: "Member",
      });

      expect(await getStoredChatMetadata(db, 555)).toBeNull();
    });

    it("follows a renamed Chat", async () => {
      await upsertChatFromTelegramUpdate(db, groupChat);

      await upsertChatFromTelegramUpdate(db, groupChat, {
        newTitle: "Пятница вечером",
      });

      expect(await getStoredChatMetadata(db, CHAT_ID)).toMatchObject({
        title: "Пятница вечером",
      });
    });

    it("records a new Chat photo", async () => {
      await upsertChatFromTelegramUpdate(db, groupChat, {
        newPhoto: [
          {
            file_id: "small-1",
            file_unique_id: "unique-1",
            width: 160,
            height: 160,
          },
        ],
      });

      expect(await getStoredChatMetadata(db, CHAT_ID)).toMatchObject({
        photoSmallFileId: "small-1",
        photoUniqueId: "unique-1",
      });
    });

    it("clears the photo reference when the Chat photo is deleted", async () => {
      await upsertChatFromTelegramUpdate(db, groupChat, {
        newPhoto: [
          {
            file_id: "small-1",
            file_unique_id: "unique-1",
            width: 160,
            height: 160,
          },
        ],
      });

      await upsertChatFromTelegramUpdate(db, groupChat, { deletePhoto: true });

      expect(await getStoredChatMetadata(db, CHAT_ID)).toMatchObject({
        photoSmallFileId: null,
        photoUniqueId: null,
      });
    });

    it("keeps a known photo when an ordinary message carries none", async () => {
      await upsertChatFromTelegramUpdate(db, groupChat, {
        newPhoto: [
          {
            file_id: "small-1",
            file_unique_id: "unique-1",
            width: 160,
            height: 160,
          },
        ],
      });

      await upsertChatFromTelegramUpdate(db, groupChat);

      expect(await getStoredChatMetadata(db, CHAT_ID)).toMatchObject({
        photoSmallFileId: "small-1",
      });
    });
  });

  describe("resolveChatMetadata", () => {
    /**
     * Store metadata and report when Telegram was actually asked. The stamp is
     * always wall-clock — only the freshness comparison takes `now` — so the
     * age cases have to be expressed relative to this.
     */
    async function storeMetadata(): Promise<Date> {
      mocks.getChat.mockResolvedValue(telegramChat());
      await resolveChatMetadata(db, CHAT_ID, BOT_TOKEN, { force: true });
      mocks.getChat.mockClear();
      const stored = await getStoredChatMetadata(db, CHAT_ID);
      if (!stored?.metadataCheckedAt) throw new Error("metadata not stored");
      return stored.metadataCheckedAt;
    }

    it("serves metadata checked less than a day ago without asking Telegram", async () => {
      const storedAt = await storeMetadata();
      mocks.getChat.mockResolvedValue(telegramChat({ title: "Новое имя" }));

      const metadata = await resolveChatMetadata(db, CHAT_ID, BOT_TOKEN, {
        now: new Date(storedAt.getTime() + 23 * 60 * 60 * 1_000),
      });

      expect(mocks.getChat).not.toHaveBeenCalled();
      expect(metadata).toMatchObject({ title: "Пятница" });
    });

    it("refreshes metadata older than a day", async () => {
      const storedAt = await storeMetadata();
      mocks.getChat.mockResolvedValue(
        telegramChat({
          title: "Новое имя",
          photo: {
            small_file_id: "small-2",
            small_file_unique_id: "unique-2",
            big_file_id: "big-2",
            big_file_unique_id: "unique-big-2",
          },
        }),
      );

      const metadata = await resolveChatMetadata(db, CHAT_ID, BOT_TOKEN, {
        now: new Date(storedAt.getTime() + 25 * 60 * 60 * 1_000),
      });

      expect(mocks.getChat).toHaveBeenCalledOnce();
      expect(metadata).toMatchObject({
        title: "Новое имя",
        photoSmallFileId: "small-2",
        photoUniqueId: "unique-2",
      });
      expect(await getStoredChatMetadata(db, CHAT_ID)).toMatchObject({
        title: "Новое имя",
      });
    });

    it("refreshes fresh metadata anyway when forced", async () => {
      await storeMetadata();
      mocks.getChat.mockResolvedValue(telegramChat({ title: "Новое имя" }));

      const metadata = await resolveChatMetadata(db, CHAT_ID, BOT_TOKEN, {
        force: true,
      });

      expect(mocks.getChat).toHaveBeenCalledOnce();
      expect(metadata).toMatchObject({ title: "Новое имя" });
    });

    it("falls back to stored metadata when Telegram is unreachable", async () => {
      await storeMetadata();
      mocks.getChat.mockRejectedValue(new Error("network unavailable"));

      const metadata = await resolveChatMetadata(db, CHAT_ID, BOT_TOKEN, {
        force: true,
      });

      expect(metadata).toMatchObject({ title: "Пятница" });
    });

    it("returns nothing for a Chat it has never seen and cannot reach", async () => {
      mocks.getChat.mockRejectedValue(new Error("network unavailable"));

      expect(await resolveChatMetadata(db, -1, BOT_TOKEN)).toBeNull();
    });
  });
});
