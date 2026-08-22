import { describe, expect, it } from "vitest";

import { closePgliteDb, createPgliteDb } from "@/lib/db/pglite";
import { chats, registrations } from "@/lib/db/schema";

import { listChatsForUser } from "./chats-query";

describe("listChatsForUser", () => {
  it("returns Telegram metadata and fallbacks sorted by chat id", async () => {
    const pglite = await createPgliteDb();

    try {
      await pglite.db.insert(registrations).values([
        { chatId: -100_222, userId: 501 },
        { chatId: -100_111, userId: 501 },
      ]);
      await pglite.db.insert(chats).values({
        chatId: -100_111,
        title: "Настоящее название",
        photoUniqueId: "photo-v1",
      });

      await expect(listChatsForUser(pglite.db, 501)).resolves.toEqual([
        { chatId: -100_222, title: "Чат -100222", photoVersion: null },
        {
          chatId: -100_111,
          title: "Настоящее название",
          photoVersion: "photo-v1",
        },
      ]);
    } finally {
      await closePgliteDb(pglite);
    }
  });
});
