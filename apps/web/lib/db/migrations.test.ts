import { describe, expect, it } from "vitest";

import { closePgliteDb, createPgliteDb } from "./pglite";
import {
  chats,
  displayIdentities,
  marks,
  messageAuthors,
  processedUpdates,
  registrations,
} from "./schema";

const CHAT_ID = -100123;

const mark = {
  type: "karma.plus",
  chatId: CHAT_ID,
  actorId: 1,
  subjectId: 2,
  messageId: 10,
  createdAt: new Date("2026-08-01T09:00:00.000Z"),
  source: "reaction",
} as const;

describe("Drizzle migrations on PGlite", () => {
  it("applies migrations and supports all six tables", async () => {
    const pglite = await createPgliteDb();

    try {
      await pglite.db.insert(marks).values(mark);

      await pglite.db.insert(chats).values({
        chatId: CHAT_ID,
        title: "Test Chat",
      });

      await pglite.db.insert(displayIdentities).values({
        chatId: CHAT_ID,
        userId: 2,
        displayName: "@alice",
      });

      await pglite.db.insert(registrations).values({
        chatId: CHAT_ID,
        userId: 1,
      });

      await pglite.db.insert(messageAuthors).values({
        chatId: CHAT_ID,
        messageId: 10,
        authorId: 2,
        authorIsBot: false,
        messageDate: 1_722_513_600,
      });

      await pglite.db.insert(processedUpdates).values({ updateId: 42 });

      const [markRow] = await pglite.db.select().from(marks);
      expect(markRow).toMatchObject({ type: "karma.plus", source: "reaction" });

      const tables = await pglite.client.query<{ tablename: string }>(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
      );

      expect(tables.rows.map((row) => row.tablename)).toEqual([
        "chats",
        "display_identities",
        "marks",
        "message_authors",
        "processed_updates",
        "registrations",
      ]);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("derives the slot from the type", async () => {
    const pglite = await createPgliteDb();

    try {
      await pglite.db
        .insert(marks)
        .values([
          mark,
          { ...mark, type: "karma.minus", messageId: 11 },
          { ...mark, type: "humor.add", messageId: 12 },
        ]);

      const rows = await pglite.db.select().from(marks);
      expect(rows.map((row) => [row.type, row.slot]).toSorted()).toEqual([
        ["humor.add", "humor"],
        ["karma.minus", "karma"],
        ["karma.plus", "karma"],
      ]);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("refuses a second Mark in a slot the Actor already spent", async () => {
    const pglite = await createPgliteDb();

    try {
      await pglite.db.insert(marks).values(mark);

      // Same slot, either way it is spent.
      await expect(pglite.db.insert(marks).values(mark)).rejects.toThrow();
      await expect(
        pglite.db.insert(marks).values({ ...mark, type: "karma.minus" }),
      ).rejects.toThrow();

      // The humor grant is independent, and so is every other Message.
      await pglite.db.insert(marks).values({ ...mark, type: "humor.add" });
      await pglite.db.insert(marks).values({ ...mark, messageId: 11 });
      await expect(pglite.db.select().from(marks)).resolves.toHaveLength(3);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("enforces canonical types, sources, and unique legacy ids", async () => {
    const pglite = await createPgliteDb();
    const legacyId = "11111111-1111-4111-8111-111111111111";

    try {
      await expect(
        pglite.db.insert(marks).values({ ...mark, type: "karma.undo.plus" }),
      ).rejects.toThrow();
      await expect(
        pglite.db.insert(marks).values({ ...mark, source: "import" }),
      ).rejects.toThrow();

      await pglite.db
        .insert(marks)
        .values({ ...mark, source: "reply", legacyId });
      await expect(
        pglite.db
          .insert(marks)
          .values({ ...mark, source: "reply", messageId: 11, legacyId }),
      ).rejects.toThrow();
    } finally {
      await closePgliteDb(pglite);
    }
  });
});
