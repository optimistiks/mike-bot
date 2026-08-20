import { describe, expect, it } from "vitest";

import { closePgliteDb, createPgliteDb } from "./pglite";
import {
  displayIdentities,
  events,
  messageAuthors,
  processedUpdates,
  registrationMessages,
  registrations,
} from "./schema";

describe("Drizzle migrations on PGlite", () => {
  it("applies migrations and supports all six tables", async () => {
    const pglite = await createPgliteDb();

    try {
      await pglite.db.insert(events).values({
        type: "karma.plus",
        chatId: -100123,
        actorId: 1,
        subjectId: 2,
        messageId: 10,
        createdAt: new Date("2026-08-01T09:00:00.000Z"),
      });

      await pglite.db.insert(displayIdentities).values({
        chatId: -100123,
        userId: 2,
        displayName: "@alice",
      });

      await pglite.db.insert(registrations).values({
        chatId: -100123,
        userId: 1,
      });

      await pglite.db.insert(messageAuthors).values({
        chatId: -100123,
        messageId: 10,
        authorId: 2,
        authorIsBot: false,
        messageDate: 1_722_513_600,
      });

      await pglite.db.insert(processedUpdates).values({ updateId: 42 });

      await pglite.db.insert(registrationMessages).values({
        chatId: -100123,
        messageId: 99,
        createdAt: new Date("2026-08-01T09:00:00.000Z"),
      });

      const [eventRow] = await pglite.db.select().from(events);
      expect(eventRow.type).toBe("karma.plus");

      const tables = await pglite.client.query<{ tablename: string }>(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
      );

      expect(tables.rows.map((row) => row.tablename)).toEqual([
        "display_identities",
        "events",
        "message_authors",
        "processed_updates",
        "registration_messages",
        "registrations",
      ]);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("enforces unique legacy_id on events", async () => {
    const pglite = await createPgliteDb();
    const legacyId = "11111111-1111-4111-8111-111111111111";

    try {
      const base = {
        type: "humor.add",
        chatId: -100123,
        actorId: 1,
        subjectId: 2,
        messageId: 11,
        createdAt: new Date("2026-08-01T09:00:00.000Z"),
        legacyId,
      };

      await pglite.db.insert(events).values(base);
      await expect(
        pglite.db.insert(events).values({ ...base, messageId: 12 }),
      ).rejects.toThrow();
    } finally {
      await closePgliteDb(pglite);
    }
  });
});
