import { describe, expect, it } from "vitest";

import { closePgliteDb, createPgliteDb } from "@/lib/db/pglite";
import { chatMemberships } from "@/lib/db/schema";

import { listChatsForUser } from "./chats-query";

describe("listChatsForUser", () => {
  it("returns memberships sorted by chat id with Russian labels", async () => {
    const pglite = await createPgliteDb();

    try {
      await pglite.db.insert(chatMemberships).values([
        { chatId: -100_222, userId: 501 },
        { chatId: -100_111, userId: 501 },
      ]);

      await expect(listChatsForUser(pglite.db, 501)).resolves.toEqual([
        { chatId: -100_222, label: "Чат -100222" },
        { chatId: -100_111, label: "Чат -100111" },
      ]);
    } finally {
      await closePgliteDb(pglite);
    }
  });
});
