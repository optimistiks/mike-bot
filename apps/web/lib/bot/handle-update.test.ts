import { describe, expect, it } from "vitest";
import type { ReactionType, Update } from "grammy/types";

import { closePgliteDb, createPgliteDb } from "@/lib/db/pglite";
import {
  displayIdentities,
  marks,
  messageAuthors,
  processedUpdates,
  registrations,
} from "@/lib/db/schema";
import { queryLeaderboard } from "@/lib/leaderboard/query";

import { getMessageAuthor, handleTelegramUpdate } from "./handle-update";

const TEST_CHAT_ID = -100_111_222;
const BOT_USER_ID = 777;
const BOT_MESSAGE_ID = 500;

function messageUpdate(
  updateId: number,
  messageId: number,
  from: { id: number; first_name: string; username?: string; is_bot?: boolean },
  date = "2026-08-10T11:00:00.000Z",
  chatType: "private" | "group" | "supergroup" = "supergroup",
): Update {
  return {
    update_id: updateId,
    message: {
      message_id: messageId,
      date: Math.floor(new Date(date).getTime() / 1000),
      chat:
        chatType === "private"
          ? { id: TEST_CHAT_ID, type: chatType, first_name: "Test" }
          : { id: TEST_CHAT_ID, type: chatType, title: "Test" },
      from: { is_bot: false, ...from },
      text: "hello",
    },
  };
}

function reactionUpdate(
  updateId: number,
  messageId: number,
  actor: { id: number; first_name: string; username?: string },
  oldReaction: ReactionType[],
  newReaction: ReactionType[],
  date = "2026-08-10T12:00:00.000Z",
  chatType: "private" | "group" | "supergroup" = "supergroup",
): Update {
  return {
    update_id: updateId,
    message_reaction: {
      chat:
        chatType === "private"
          ? { id: TEST_CHAT_ID, type: chatType, first_name: "Test" }
          : { id: TEST_CHAT_ID, type: chatType, title: "Test" },
      message_id: messageId,
      user: {
        id: actor.id,
        is_bot: false,
        first_name: actor.first_name,
        username: actor.username,
      },
      date: Math.floor(new Date(date).getTime() / 1000),
      old_reaction: oldReaction,
      new_reaction: newReaction,
    },
  };
}

function chatMemberUpdate(
  updateId: number,
  user: { id: number; first_name: string; username?: string },
  status: "member" | "left" | "kicked",
): Update {
  const oldStatus =
    status === "member" ? ("left" as const) : ("member" as const);
  const newChatMember =
    status === "kicked"
      ? {
          status: "kicked" as const,
          user: { id: user.id, is_bot: false, first_name: user.first_name },
          until_date: 0,
        }
      : status === "member"
        ? {
            status: "member" as const,
            user: { id: user.id, is_bot: false, first_name: user.first_name },
          }
        : {
            status: "left" as const,
            user: { id: user.id, is_bot: false, first_name: user.first_name },
          };

  return {
    update_id: updateId,
    chat_member: {
      chat: { id: TEST_CHAT_ID, type: "supergroup", title: "Test" },
      from: { id: 999, is_bot: false, first_name: "Admin" },
      date: Math.floor(Date.now() / 1000),
      old_chat_member: {
        status: oldStatus,
        user: { id: user.id, is_bot: false, first_name: user.first_name },
      },
      new_chat_member: newChatMember,
    },
  } satisfies Update;
}

describe("telegram webhook integration", () => {
  it("caches message authors and appends karma.plus visible on leaderboard", async () => {
    const pglite = await createPgliteDb();

    try {
      await handleTelegramUpdate(
        pglite.db,
        messageUpdate(1, 42, {
          id: 201,
          first_name: "Bob",
          username: "bob",
        }),
      );

      const cached = await getMessageAuthor(pglite.db, TEST_CHAT_ID, 42);
      expect(cached).toMatchObject({
        authorId: 201,
        authorIsBot: false,
      });

      await handleTelegramUpdate(
        pglite.db,
        reactionUpdate(
          2,
          42,
          { id: 301, first_name: "Alice", username: "alice" },
          [],
          [{ type: "emoji", emoji: "👍" }],
        ),
      );

      const rows = await pglite.db.select().from(marks);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        type: "karma.plus",
        chatId: TEST_CHAT_ID,
        actorId: 301,
        subjectId: 201,
        messageId: 42,
      });

      const leaderboard = await queryLeaderboard(pglite.db, TEST_CHAT_ID, {
        year: 2026,
        month: 8,
      });

      const karmaReceived = leaderboard.sections[0]?.entries ?? [];
      expect(karmaReceived).toContainEqual(
        expect.objectContaining({ displayName: "@bob", score: 1 }),
      );
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("takes a reaction back inside the Undo window and lets it be re-spent", async () => {
    const pglite = await createPgliteDb();
    const alice = { id: 301, first_name: "Alice" };
    const thumbsUp: ReactionType[] = [{ type: "emoji", emoji: "👍" }];

    try {
      await handleTelegramUpdate(
        pglite.db,
        messageUpdate(40, 60, { id: 201, first_name: "Bob" }),
      );
      await handleTelegramUpdate(
        pglite.db,
        reactionUpdate(41, 60, alice, [], thumbsUp, "2026-08-10T12:00:00.000Z"),
      );
      await handleTelegramUpdate(
        pglite.db,
        reactionUpdate(42, 60, alice, thumbsUp, [], "2026-08-10T12:00:03.000Z"),
      );
      await expect(pglite.db.select().from(marks)).resolves.toEqual([]);

      await handleTelegramUpdate(
        pglite.db,
        reactionUpdate(43, 60, alice, [], thumbsUp, "2026-08-10T12:00:10.000Z"),
      );
      const rows = await pglite.db.select().from(marks);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        type: "karma.plus",
        slot: "karma",
        source: "reaction",
      });

      // The window has closed on this one, so the removal changes nothing.
      await handleTelegramUpdate(
        pglite.db,
        reactionUpdate(44, 60, alice, thumbsUp, [], "2026-08-10T12:05:00.000Z"),
      );
      await expect(pglite.db.select().from(marks)).resolves.toHaveLength(1);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("switches 👍 to 👎 only while the Undo window is open", async () => {
    const pglite = await createPgliteDb();
    const alice = { id: 301, first_name: "Alice" };
    const thumbsUp: ReactionType[] = [{ type: "emoji", emoji: "👍" }];
    const thumbsDown: ReactionType[] = [{ type: "emoji", emoji: "👎" }];

    try {
      await handleTelegramUpdate(
        pglite.db,
        messageUpdate(40, 60, { id: 201, first_name: "Bob" }),
      );
      await handleTelegramUpdate(
        pglite.db,
        messageUpdate(50, 61, { id: 201, first_name: "Bob" }),
      );

      // Telegram delivers a switch as one update: removal, then addition.
      await handleTelegramUpdate(
        pglite.db,
        reactionUpdate(41, 60, alice, [], thumbsUp, "2026-08-10T12:00:00.000Z"),
      );
      await handleTelegramUpdate(
        pglite.db,
        reactionUpdate(
          42,
          60,
          alice,
          thumbsUp,
          thumbsDown,
          "2026-08-10T12:00:02.000Z",
        ),
      );

      await handleTelegramUpdate(
        pglite.db,
        reactionUpdate(51, 61, alice, [], thumbsUp, "2026-08-10T12:00:00.000Z"),
      );
      await handleTelegramUpdate(
        pglite.db,
        reactionUpdate(
          52,
          61,
          alice,
          thumbsUp,
          thumbsDown,
          "2026-08-10T12:30:00.000Z",
        ),
      );

      const rows = await pglite.db.select().from(marks);
      expect(rows.map((row) => [row.messageId, row.type]).toSorted()).toEqual([
        [60, "karma.minus"],
        [61, "karma.plus"],
      ]);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("does not resurrect an undone Mark when its update is redelivered", async () => {
    const pglite = await createPgliteDb();
    const alice = { id: 301, first_name: "Alice" };
    const thumbsUp: ReactionType[] = [{ type: "emoji", emoji: "👍" }];

    try {
      await handleTelegramUpdate(
        pglite.db,
        messageUpdate(40, 60, { id: 201, first_name: "Bob" }),
      );
      const addition = reactionUpdate(
        41,
        60,
        alice,
        [],
        thumbsUp,
        "2026-08-10T12:00:00.000Z",
      );

      await handleTelegramUpdate(pglite.db, addition);
      await handleTelegramUpdate(
        pglite.db,
        reactionUpdate(42, 60, alice, thumbsUp, [], "2026-08-10T12:00:02.000Z"),
      );
      await expect(handleTelegramUpdate(pglite.db, addition)).resolves.toBe(
        false,
      );

      await expect(pglite.db.select().from(marks)).resolves.toEqual([]);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("ignores concurrently delivered duplicate update_id", async () => {
    const pglite = await createPgliteDb();

    try {
      const update = messageUpdate(99, 1, {
        id: 201,
        first_name: "Bob",
      });

      await Promise.all([
        handleTelegramUpdate(pglite.db, update),
        handleTelegramUpdate(pglite.db, update),
      ]);

      const markRows = await pglite.db.select().from(marks);
      expect(markRows).toHaveLength(0);
      await expect(pglite.db.select().from(processedUpdates)).resolves.toEqual([
        { updateId: 99 },
      ]);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("skips reaction on uncached message without appending Marks", async () => {
    const pglite = await createPgliteDb();

    try {
      await handleTelegramUpdate(
        pglite.db,
        reactionUpdate(
          3,
          999,
          { id: 301, first_name: "Alice" },
          [],
          [{ type: "emoji", emoji: "👍" }],
        ),
      );

      const rows = await pglite.db.select().from(marks);
      expect(rows).toHaveLength(0);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("credits a grace-window reaction to the message Season", async () => {
    const pglite = await createPgliteDb();

    try {
      await handleTelegramUpdate(
        pglite.db,
        messageUpdate(
          4,
          43,
          { id: 201, first_name: "Bob" },
          "2026-01-31T20:00:00.000Z",
        ),
      );
      await handleTelegramUpdate(
        pglite.db,
        reactionUpdate(
          5,
          43,
          { id: 301, first_name: "Alice" },
          [],
          [{ type: "emoji", emoji: "👍" }],
          "2026-01-31T21:09:59.000Z",
        ),
      );

      await expect(pglite.db.select().from(marks)).resolves.toHaveLength(1);
      const january = await queryLeaderboard(pglite.db, TEST_CHAT_ID, {
        year: 2026,
        month: 1,
      });
      expect(january.sections[0]?.entries).toEqual([
        expect.objectContaining({ userId: 201, score: 1 }),
      ]);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("records no Mark when the message Season is closed", async () => {
    const pglite = await createPgliteDb();

    try {
      await handleTelegramUpdate(
        pglite.db,
        messageUpdate(
          6,
          44,
          { id: 201, first_name: "Bob" },
          "2026-01-31T20:00:00.000Z",
        ),
      );
      await handleTelegramUpdate(
        pglite.db,
        reactionUpdate(
          7,
          44,
          { id: 301, first_name: "Alice" },
          [],
          [{ type: "emoji", emoji: "👍" }],
          "2026-01-31T21:10:00.000Z",
        ),
      );

      await expect(pglite.db.select().from(marks)).resolves.toEqual([]);
      await expect(pglite.db.select().from(processedUpdates)).resolves.toEqual([
        { updateId: 6 },
        { updateId: 7 },
      ]);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("ignores private-chat messages and reactions", async () => {
    const pglite = await createPgliteDb();

    try {
      await handleTelegramUpdate(
        pglite.db,
        messageUpdate(
          8,
          45,
          { id: 201, first_name: "Bob" },
          undefined,
          "private",
        ),
      );
      await handleTelegramUpdate(
        pglite.db,
        reactionUpdate(
          9,
          45,
          { id: 301, first_name: "Alice" },
          [],
          [{ type: "emoji", emoji: "👍" }],
          undefined,
          "private",
        ),
      );

      await expect(
        getMessageAuthor(pglite.db, TEST_CHAT_ID, 45),
      ).resolves.toBeUndefined();
      await expect(pglite.db.select().from(displayIdentities)).resolves.toEqual(
        [],
      );
      await expect(pglite.db.select().from(marks)).resolves.toEqual([]);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("caches bot-authored messages without creating a Display identity", async () => {
    const pglite = await createPgliteDb();

    try {
      await handleTelegramUpdate(
        pglite.db,
        messageUpdate(13, 46, {
          id: BOT_USER_ID,
          first_name: "Bot",
          is_bot: true,
        }),
      );

      await expect(
        getMessageAuthor(pglite.db, TEST_CHAT_ID, 46),
      ).resolves.toMatchObject({ authorId: BOT_USER_ID, authorIsBot: true });
      await expect(pglite.db.select().from(displayIdentities)).resolves.toEqual(
        [],
      );
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("skips the author cache for an ephemeral command message", async () => {
    const pglite = await createPgliteDb();

    try {
      const update = messageUpdate(14, 0, { id: 205, first_name: "Eph" });
      if (!update.message) {
        throw new Error("Expected a message update");
      }
      update.message.ephemeral_message_id = 12;
      update.message.text = "/stats";

      await handleTelegramUpdate(pglite.db, update);

      await expect(pglite.db.select().from(messageAuthors)).resolves.toEqual(
        [],
      );
      await expect(pglite.db.select().from(displayIdentities)).resolves.toEqual(
        [{ chatId: TEST_CHAT_ID, userId: 205, displayName: "Eph" }],
      );
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("does not add a Registration when a member joins", async () => {
    const pglite = await createPgliteDb();

    try {
      await handleTelegramUpdate(
        pglite.db,
        chatMemberUpdate(10, { id: 501, first_name: "Dave" }, "member"),
      );

      const rows = await pglite.db.select().from(registrations);
      expect(rows).toHaveLength(0);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("removes a Registration when a member leaves", async () => {
    const pglite = await createPgliteDb();

    try {
      await pglite.db.insert(registrations).values({
        chatId: TEST_CHAT_ID,
        userId: 501,
      });

      await handleTelegramUpdate(
        pglite.db,
        chatMemberUpdate(11, { id: 501, first_name: "Dave" }, "left"),
      );

      const rows = await pglite.db.select().from(registrations);
      expect(rows).toHaveLength(0);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("removes a Registration when a member is kicked", async () => {
    const pglite = await createPgliteDb();

    try {
      await pglite.db.insert(registrations).values({
        chatId: TEST_CHAT_ID,
        userId: 502,
      });

      await handleTelegramUpdate(
        pglite.db,
        chatMemberUpdate(12, { id: 502, first_name: "Eve" }, "kicked"),
      );

      const rows = await pglite.db.select().from(registrations);
      expect(rows).toHaveLength(0);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("ignores reactions on bot-authored messages", async () => {
    const pglite = await createPgliteDb();

    try {
      await pglite.db.insert(messageAuthors).values({
        chatId: TEST_CHAT_ID,
        messageId: BOT_MESSAGE_ID,
        authorId: BOT_USER_ID,
        authorIsBot: true,
        messageDate: 1_722_513_600,
      });

      await handleTelegramUpdate(
        pglite.db,
        reactionUpdate(
          20,
          BOT_MESSAGE_ID,
          { id: 601, first_name: "Reg", username: "reguser" },
          [],
          [{ type: "emoji", emoji: "👍" }],
        ),
      );

      await expect(pglite.db.select().from(registrations)).resolves.toEqual([]);
      await expect(pglite.db.select().from(marks)).resolves.toEqual([]);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("rolls back the update claim when processing fails", async () => {
    const pglite = await createPgliteDb();

    try {
      await handleTelegramUpdate(
        pglite.db,
        messageUpdate(29, 999, { id: 201, first_name: "Bob" }),
      );
      const invalid = reactionUpdate(
        30,
        999,
        { id: 301, first_name: "Alice" },
        [],
        [{ type: "emoji", emoji: "👍" }],
      );
      if (!invalid.message_reaction) {
        throw new Error("Expected a reaction update");
      }
      invalid.message_reaction.date = Number.NaN;

      await expect(handleTelegramUpdate(pglite.db, invalid)).rejects.toThrow();
      await expect(pglite.db.select().from(processedUpdates)).resolves.toEqual([
        { updateId: 29 },
      ]);

      await handleTelegramUpdate(
        pglite.db,
        reactionUpdate(
          30,
          999,
          { id: 301, first_name: "Alice" },
          [],
          [{ type: "emoji", emoji: "👍" }],
        ),
      );
      await expect(pglite.db.select().from(marks)).resolves.toHaveLength(1);
    } finally {
      await closePgliteDb(pglite);
    }
  });
});
