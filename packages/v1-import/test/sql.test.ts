import type { V1LolRow } from "@mike-bot/v1-export";

import { schema } from "@mike-bot/bot-core";
import { buildImportSql, splitStatements } from "@mike-bot/v1-import";
import { asc, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { closeTestDb, createTestDb } from "./pglite.js";

const { marks, members, messages } = schema;

const IMPORT_CHAT_ID = -100_999_888;

const SAMPLE_ROW: V1LolRow = {
  chatId: IMPORT_CHAT_ID,
  createdAt: Date.parse("2026-07-31T21:00:00.000Z"),
  fromUser: { id: 501, username: "giver" },
  id: "11111111-1111-4111-8111-111111111111",
  lolType: "plus",
  toMessageId: 77,
  toUser: { id: 502, username: "receiver" },
};

const SECOND_ROW: V1LolRow = {
  chatId: IMPORT_CHAT_ID,
  createdAt: Date.parse("2026-07-31T22:00:00.000Z"),
  fromUser: { id: 502, username: "receiver" },
  id: "22222222-2222-4222-8222-222222222222",
  lolType: "lol",
  toMessageId: 78,
  toUser: { id: 501, username: "giver" },
};

/** Run generated SQL the way the load CLI does: one statement per round trip. */
async function execute(
  database: Awaited<ReturnType<typeof createTestDb>>,
  sql: string,
): Promise<void> {
  for (const statement of splitStatements(sql)) {
    // eslint-disable-next-line no-await-in-loop -- each statement is its own implicit transaction
    await database.client.query(statement);
  }
}

describe("v1 import SQL", () => {
  it("produces inserts that land the expected rows", async () => {
    expect.hasAssertions();
    const database = await createTestDb();

    try {
      const { sql, stats } = buildImportSql([SAMPLE_ROW, SECOND_ROW]);
      expect({
        hasBegin: sql.includes("BEGIN"),
        hasConflict: sql.includes("ON CONFLICT"),
        hasUpdate: sql.includes("DO UPDATE"),
        stats,
      }).toStrictEqual({
        hasBegin: false,
        hasConflict: true,
        hasUpdate: false,
        stats: {
          marks: 2,
          members: 2,
          messages: 2,
          rowsProcessed: 2,
          statements: 3,
        },
      });

      await execute(database, sql);

      await expect(
        database.db
          .select()
          .from(marks)
          .where(eq(marks.chatId, IMPORT_CHAT_ID))
          .orderBy(asc(marks.createdAt)),
      ).resolves.toStrictEqual([
        {
          actorId: 501,
          chatId: IMPORT_CHAT_ID,
          createdAt: new Date(SAMPLE_ROW.createdAt),
          messageId: 77,
          slot: "karma",
          subjectId: 502,
          type: "karma.plus",
        },
        {
          actorId: 502,
          chatId: IMPORT_CHAT_ID,
          createdAt: new Date(SECOND_ROW.createdAt),
          messageId: 78,
          slot: "humor",
          subjectId: 501,
          type: "humor.add",
        },
      ]);

      await expect(
        database.db.select().from(messages).orderBy(asc(messages.messageId)),
      ).resolves.toStrictEqual([
        {
          authorId: 502,
          chatId: IMPORT_CHAT_ID,
          messageId: 77,
          postedAt: new Date("2026-07-31T21:00:00.000Z"),
        },
        {
          authorId: 501,
          chatId: IMPORT_CHAT_ID,
          messageId: 78,
          postedAt: new Date("2026-07-31T22:00:00.000Z"),
        },
      ]);

      await expect(
        database.db.select().from(members).orderBy(asc(members.telegramId)),
      ).resolves.toStrictEqual([
        { firstName: null, lastName: null, telegramId: 501, username: "giver" },
        { firstName: null, lastName: null, telegramId: 502, username: "receiver" },
      ]);
    } finally {
      await closeTestDb(database);
    }
  });

  it("is idempotent across repeated runs", async () => {
    expect.hasAssertions();
    const database = await createTestDb();

    try {
      const { sql } = buildImportSql([SAMPLE_ROW, SECOND_ROW]);
      await execute(database, sql);
      await execute(database, sql);

      await expect(database.db.select().from(marks)).resolves.toHaveLength(2);
      await expect(database.db.select().from(messages)).resolves.toHaveLength(2);
      await expect(database.db.select().from(members)).resolves.toHaveLength(2);
    } finally {
      await closeTestDb(database);
    }
  });

  it("preserves members the bot already stored", async () => {
    expect.hasAssertions();
    const database = await createTestDb();

    try {
      await database.db.insert(members).values({
        telegramId: 501,
        username: "renamed",
      });

      const { sql } = buildImportSql([SAMPLE_ROW]);
      await execute(database, sql);

      await expect(
        database.db.select().from(members).where(eq(members.telegramId, 501)),
      ).resolves.toStrictEqual([
        { firstName: null, lastName: null, telegramId: 501, username: "renamed" },
      ]);
    } finally {
      await closeTestDb(database);
    }
  });

  it("escapes quotes in usernames", async () => {
    expect.hasAssertions();
    const database = await createTestDb();

    try {
      const { sql } = buildImportSql([
        {
          ...SAMPLE_ROW,
          fromUser: { id: 503 },
          toUser: { id: 504, username: "o'brien" },
        },
      ]);
      await execute(database, sql);

      await expect(
        database.db
          .select({ username: members.username })
          .from(members)
          .orderBy(asc(members.telegramId)),
      ).resolves.toStrictEqual([{ username: null }, { username: "o'brien" }]);
    } finally {
      await closeTestDb(database);
    }
  });

  it("keeps the earlier mark when two v1 rows share a slot", async () => {
    expect.hasAssertions();
    const database = await createTestDb();

    try {
      const laterMinus: V1LolRow = {
        ...SAMPLE_ROW,
        createdAt: SAMPLE_ROW.createdAt + 1,
        id: "33333333-3333-4333-8333-333333333333",
        lolType: "minus",
      };
      const { sql, stats } = buildImportSql([SAMPLE_ROW, laterMinus]);
      await execute(database, sql);
      const stored = await database.db.select().from(marks);

      expect({ marks: stats.marks, stored }).toStrictEqual({
        marks: 1,
        stored: [
          {
            actorId: 501,
            chatId: IMPORT_CHAT_ID,
            createdAt: new Date(SAMPLE_ROW.createdAt),
            messageId: 77,
            slot: "karma",
            subjectId: 502,
            type: "karma.plus",
          },
        ],
      });
    } finally {
      await closeTestDb(database);
    }
  });

  it("splits rows into batches", () => {
    expect.hasAssertions();
    const { sql, stats } = buildImportSql([SAMPLE_ROW, SECOND_ROW], {
      batchSize: 1,
    });

    expect({ split: splitStatements(sql).length, statements: stats.statements }).toStrictEqual({
      split: 6,
      statements: 6,
    });
  });
});
