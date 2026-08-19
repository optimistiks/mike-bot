import { describe, expect, it } from "vitest";
import type { ReactionType, Update } from "grammy/types";

import { closePgliteDb, createPgliteDb } from "@/lib/db/pglite";
import { chatMemberships, events } from "@/lib/db/schema";
import { queryLeaderboard } from "@/lib/leaderboard/query";

import { getMessageAuthor, handleTelegramUpdate } from "./handle-update";

const TEST_CHAT_ID = -100_111_222;

function messageUpdate(
  updateId: number,
  messageId: number,
  from: { id: number; first_name: string; username?: string; is_bot?: boolean },
): Update {
  return {
    update_id: updateId,
    message: {
      message_id: messageId,
      date: Math.floor(Date.now() / 1000),
      chat: { id: TEST_CHAT_ID, type: "supergroup", title: "Test" },
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
): Update {
  return {
    update_id: updateId,
    message_reaction: {
      chat: { id: TEST_CHAT_ID, type: "supergroup", title: "Test" },
      message_id: messageId,
      user: {
        id: actor.id,
        is_bot: false,
        first_name: actor.first_name,
        username: actor.username,
      },
      date: Math.floor(new Date("2026-08-10T12:00:00.000Z").getTime() / 1000),
      old_reaction: oldReaction,
      new_reaction: newReaction,
    },
  };
}

function chatMemberUpdate(
  updateId: number,
  user: { id: number; first_name: string; username?: string },
  status: "member" | "left",
): Update {
  return {
    update_id: updateId,
    chat_member: {
      chat: { id: TEST_CHAT_ID, type: "supergroup", title: "Test" },
      from: { id: 999, is_bot: false, first_name: "Admin" },
      date: Math.floor(Date.now() / 1000),
      old_chat_member:
        status === "member"
          ? {
              status: "left",
              user: { id: user.id, is_bot: false, first_name: user.first_name },
            }
          : {
              status: "member",
              user: { id: user.id, is_bot: false, first_name: user.first_name },
            },
      new_chat_member:
        status === "member"
          ? {
              status: "member",
              user: { id: user.id, is_bot: false, first_name: user.first_name },
            }
          : {
              status: "left",
              user: { id: user.id, is_bot: false, first_name: user.first_name },
            },
    },
  } satisfies Update;
}

function myChatMemberUpdate(
  updateId: number,
  botStatus: "administrator" | "left",
  fromUserId: number,
): Update {
  return {
    update_id: updateId,
    my_chat_member: {
      chat: { id: TEST_CHAT_ID, type: "supergroup", title: "Test" },
      from: { id: fromUserId, is_bot: false, first_name: "Admin" },
      date: Math.floor(Date.now() / 1000),
      old_chat_member:
        botStatus === "administrator"
          ? {
              status: "left",
              user: { id: 777, is_bot: true, first_name: "Mike" },
            }
          : {
              status: "administrator",
              user: { id: 777, is_bot: true, first_name: "Mike" },
            },
      new_chat_member:
        botStatus === "administrator"
          ? {
              status: "administrator",
              user: { id: 777, is_bot: true, first_name: "Mike" },
            }
          : {
              status: "left",
              user: { id: 777, is_bot: true, first_name: "Mike" },
            },
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

      const rows = await pglite.db.select().from(events);
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

  it("ignores duplicate update_id", async () => {
    const pglite = await createPgliteDb();

    try {
      const update = messageUpdate(99, 1, {
        id: 201,
        first_name: "Bob",
      });

      await handleTelegramUpdate(pglite.db, update);
      await handleTelegramUpdate(pglite.db, update);

      const rows = await pglite.db.select().from(events);
      expect(rows).toHaveLength(0);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("skips reaction on uncached message without appending events", async () => {
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

      const rows = await pglite.db.select().from(events);
      expect(rows).toHaveLength(0);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("adds chat_memberships when a member joins", async () => {
    const pglite = await createPgliteDb();

    try {
      await handleTelegramUpdate(
        pglite.db,
        chatMemberUpdate(10, { id: 501, first_name: "Dave" }, "member"),
      );

      const rows = await pglite.db.select().from(chatMemberships);
      expect(rows).toEqual([{ chatId: TEST_CHAT_ID, userId: 501 }]);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("removes chat_memberships when a member leaves", async () => {
    const pglite = await createPgliteDb();

    try {
      await pglite.db.insert(chatMemberships).values({
        chatId: TEST_CHAT_ID,
        userId: 501,
      });

      await handleTelegramUpdate(
        pglite.db,
        chatMemberUpdate(11, { id: 501, first_name: "Dave" }, "left"),
      );

      const rows = await pglite.db.select().from(chatMemberships);
      expect(rows).toHaveLength(0);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("seeds membership for the admin who added the bot", async () => {
    const pglite = await createPgliteDb();

    try {
      await handleTelegramUpdate(
        pglite.db,
        myChatMemberUpdate(12, "administrator", 900),
      );

      const rows = await pglite.db.select().from(chatMemberships);
      expect(rows).toEqual([{ chatId: TEST_CHAT_ID, userId: 900 }]);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("clears chat_memberships when the bot leaves a chat", async () => {
    const pglite = await createPgliteDb();

    try {
      await pglite.db.insert(chatMemberships).values([
        { chatId: TEST_CHAT_ID, userId: 501 },
        { chatId: TEST_CHAT_ID, userId: 502 },
      ]);

      await handleTelegramUpdate(
        pglite.db,
        myChatMemberUpdate(13, "left", 900),
      );

      const rows = await pglite.db.select().from(chatMemberships);
      expect(rows).toHaveLength(0);
    } finally {
      await closePgliteDb(pglite);
    }
  });
});
