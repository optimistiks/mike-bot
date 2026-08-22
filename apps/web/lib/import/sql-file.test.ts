import { asc, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { closePgliteDb, createPgliteDb } from "@/lib/db/pglite";
import { displayIdentities, events, messageAuthors } from "@/lib/db/schema";

import { buildImportSql, splitStatements } from "./sql-file";
import type { V1LolRow } from "./v1-row";

const IMPORT_CHAT_ID = -100_999_888;

const SAMPLE_ROW: V1LolRow = {
  id: "11111111-1111-4111-8111-111111111111",
  createdAt: Date.parse("2026-07-31T21:00:00.000Z"),
  lolType: "plus",
  fromUser: { id: 501, username: "giver" },
  toUser: { id: 502, username: "receiver" },
  chatId: IMPORT_CHAT_ID,
  toMessageId: 77,
};

const SECOND_ROW: V1LolRow = {
  id: "22222222-2222-4222-8222-222222222222",
  createdAt: Date.parse("2026-07-31T22:00:00.000Z"),
  lolType: "lol",
  fromUser: { id: 502, username: "receiver" },
  toUser: { id: 501, username: "giver" },
  chatId: IMPORT_CHAT_ID,
  toMessageId: 78,
};

/** Run a generated file the way scripts/import-run.ts does: statement by statement. */
async function execute(
  pglite: Awaited<ReturnType<typeof createPgliteDb>>,
  sql: string,
): Promise<void> {
  for (const statement of splitStatements(sql)) {
    await pglite.client.query(statement);
  }
}

describe("buildImportSql", () => {
  it("produces inserts that land the expected rows", async () => {
    const pglite = await createPgliteDb();

    try {
      const { sql, stats } = buildImportSql([SAMPLE_ROW, SECOND_ROW]);
      expect(stats).toEqual({
        rowsProcessed: 2,
        events: 2,
        messages: 2,
        displayIdentities: 2,
        skippedMessages: 0,
        statements: 3,
      });
      expect(sql).not.toContain("BEGIN");
      expect(sql).toContain("ON CONFLICT");

      await execute(pglite, sql);

      const storedEvents = await pglite.db
        .select()
        .from(events)
        .where(eq(events.chatId, IMPORT_CHAT_ID))
        .orderBy(asc(events.createdAt));

      expect(storedEvents).toHaveLength(2);
      expect(storedEvents[0]).toMatchObject({
        type: "karma.plus",
        actorId: 501,
        subjectId: 502,
        messageId: 77,
        createdAt: new Date(SAMPLE_ROW.createdAt),
        reversible: false,
        reversesEventId: null,
        legacyId: SAMPLE_ROW.id,
      });

      await expect(
        pglite.db
          .select()
          .from(messageAuthors)
          .orderBy(asc(messageAuthors.messageId)),
      ).resolves.toEqual([
        {
          chatId: IMPORT_CHAT_ID,
          messageId: 77,
          authorId: 502,
          authorIsBot: false,
          messageDate: Math.floor(SAMPLE_ROW.createdAt / 1_000),
        },
        {
          chatId: IMPORT_CHAT_ID,
          messageId: 78,
          authorId: 501,
          authorIsBot: false,
          messageDate: Math.floor(SECOND_ROW.createdAt / 1_000),
        },
      ]);

      await expect(
        pglite.db
          .select()
          .from(displayIdentities)
          .orderBy(asc(displayIdentities.userId)),
      ).resolves.toEqual([
        { chatId: IMPORT_CHAT_ID, userId: 501, displayName: "@giver" },
        { chatId: IMPORT_CHAT_ID, userId: 502, displayName: "@receiver" },
      ]);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("is idempotent across repeated runs", async () => {
    const pglite = await createPgliteDb();

    try {
      const { sql } = buildImportSql([SAMPLE_ROW, SECOND_ROW]);
      await execute(pglite, sql);
      await execute(pglite, sql);

      await expect(pglite.db.select().from(events)).resolves.toHaveLength(2);
      await expect(
        pglite.db.select().from(messageAuthors),
      ).resolves.toHaveLength(2);
      await expect(
        pglite.db.select().from(displayIdentities),
      ).resolves.toHaveLength(2);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("preserves rows the bot already stored", async () => {
    const pglite = await createPgliteDb();

    try {
      await pglite.db.insert(displayIdentities).values({
        chatId: IMPORT_CHAT_ID,
        userId: 501,
        displayName: "@renamed",
      });

      const { sql } = buildImportSql([SAMPLE_ROW]);
      await execute(pglite, sql);

      await expect(
        pglite.db
          .select()
          .from(displayIdentities)
          .where(eq(displayIdentities.userId, 501)),
      ).resolves.toEqual([
        { chatId: IMPORT_CHAT_ID, userId: 501, displayName: "@renamed" },
      ]);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("escapes quotes in display names", async () => {
    const pglite = await createPgliteDb();

    try {
      const { sql } = buildImportSql([
        {
          ...SAMPLE_ROW,
          fromUser: { id: 503 },
          toUser: { id: 504, username: "o'brien" },
        },
      ]);
      await execute(pglite, sql);

      await expect(
        pglite.db
          .select({ displayName: displayIdentities.displayName })
          .from(displayIdentities)
          .orderBy(asc(displayIdentities.userId)),
      ).resolves.toEqual([
        { displayName: "User 503" },
        { displayName: "@o'brien" },
      ]);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("skips a Message whose v1 rows disagree about the author", () => {
    const { stats } = buildImportSql([
      SAMPLE_ROW,
      {
        ...SAMPLE_ROW,
        id: "33333333-3333-4333-8333-333333333333",
        toUser: { id: 999 },
      },
    ]);

    expect(stats.messages).toBe(0);
    expect(stats.skippedMessages).toBe(1);
    expect(stats.events).toBe(2);
  });

  it("splits rows into batches", () => {
    const { sql, stats } = buildImportSql([SAMPLE_ROW, SECOND_ROW], {
      batchSize: 1,
    });

    expect(stats.statements).toBe(6);
    expect(splitStatements(sql)).toHaveLength(6);
  });
});
