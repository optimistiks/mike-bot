import { describe, expect, it } from "vitest";
import { isNull } from "drizzle-orm";
import type { ReactionType, Update } from "grammy/types";

import {
  closePgliteDb,
  createPgliteDb,
  type PgliteDatabase,
} from "@/lib/db/pglite";
import { marks, processedUpdates, registrations } from "@/lib/db/schema";
import { queryLeaderboard } from "@/lib/leaderboard/query";

import type { MarkType } from "@/lib/domain/mark";

import { getMessageAuthor, handleTelegramUpdate } from "./handle-update";
import {
  addChatReaction,
  loadChatReactions,
  replaceChatBindings,
} from "./scoring-reactions";

const BOT_USERNAME = "mike_bot";

/**
 * A database that accepts the update claim and then goes away, so the rollback
 * is a real one: everything after the claim reads before it writes.
 */
function unreachableAfterClaim(db: PgliteDatabase["db"]): PgliteDatabase["db"] {
  return new Proxy(db, {
    get(target, property, receiver) {
      if (property !== "transaction") {
        return Reflect.get(target, property, receiver) as unknown;
      }

      return (run: (transaction: unknown) => Promise<unknown>) =>
        target.transaction((transaction) =>
          run(
            new Proxy(transaction, {
              get(inner, innerProperty, innerReceiver) {
                if (innerProperty === "select") {
                  throw new Error("database unreachable");
                }

                return Reflect.get(
                  inner,
                  innerProperty,
                  innerReceiver,
                ) as unknown;
              },
            }),
          ),
        );
    },
  });
}

/** Every update in this suite arrives at the same bot. */
function handleUpdate(
  db: PgliteDatabase["db"],
  update: Parameters<typeof handleTelegramUpdate>[1],
) {
  return handleTelegramUpdate(db, update, BOT_USERNAME);
}

/**
 * Marks that still hold their slot. An undone Scoring reaction leaves a
 * tombstone behind rather than deleting the row, so the raw table is not the
 * same question as "what did this Actor spend".
 */
function liveMarks(db: PgliteDatabase["db"]) {
  return db.select().from(marks).where(isNull(marks.undoneAt));
}

const TEST_CHAT_ID = -100_111_222;

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
      await handleUpdate(
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

      await handleUpdate(
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
      await handleUpdate(
        pglite.db,
        messageUpdate(40, 60, { id: 201, first_name: "Bob" }),
      );
      await handleUpdate(
        pglite.db,
        reactionUpdate(41, 60, alice, [], thumbsUp, "2026-08-10T12:00:00.000Z"),
      );
      await handleUpdate(
        pglite.db,
        reactionUpdate(42, 60, alice, thumbsUp, [], "2026-08-10T12:00:03.000Z"),
      );
      await expect(liveMarks(pglite.db)).resolves.toEqual([]);

      await handleUpdate(
        pglite.db,
        reactionUpdate(43, 60, alice, [], thumbsUp, "2026-08-10T12:00:10.000Z"),
      );
      const rows = await liveMarks(pglite.db);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        type: "karma.plus",
        slot: "karma",
        source: "reaction",
      });

      // The window has closed on this one, so the removal changes nothing.
      await handleUpdate(
        pglite.db,
        reactionUpdate(44, 60, alice, thumbsUp, [], "2026-08-10T12:05:00.000Z"),
      );
      await expect(liveMarks(pglite.db)).resolves.toHaveLength(1);
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
      await handleUpdate(
        pglite.db,
        messageUpdate(40, 60, { id: 201, first_name: "Bob" }),
      );
      await handleUpdate(
        pglite.db,
        messageUpdate(50, 61, { id: 201, first_name: "Bob" }),
      );

      // Telegram delivers a switch as one update: removal, then addition.
      await handleUpdate(
        pglite.db,
        reactionUpdate(41, 60, alice, [], thumbsUp, "2026-08-10T12:00:00.000Z"),
      );
      await handleUpdate(
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

      await handleUpdate(
        pglite.db,
        reactionUpdate(51, 61, alice, [], thumbsUp, "2026-08-10T12:00:00.000Z"),
      );
      await handleUpdate(
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

      const rows = await liveMarks(pglite.db);
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
      await handleUpdate(
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

      await handleUpdate(pglite.db, addition);
      await handleUpdate(
        pglite.db,
        reactionUpdate(42, 60, alice, thumbsUp, [], "2026-08-10T12:00:02.000Z"),
      );
      await expect(handleUpdate(pglite.db, addition)).resolves.toMatchObject({
        claimed: false,
      });

      await expect(liveMarks(pglite.db)).resolves.toEqual([]);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("keeps a Mark undone when its removal is handled before its addition", async () => {
    const pglite = await createPgliteDb();
    const alice = { id: 301, first_name: "Alice" };
    const thumbsUp: ReactionType[] = [{ type: "emoji", emoji: "👍" }];

    try {
      await handleUpdate(
        pglite.db,
        messageUpdate(40, 60, { id: 201, first_name: "Bob", username: "bob" }),
      );

      // Alice taps 👍 and untaps three seconds later. Telegram delivers both
      // updates at once and the removal is handled first.
      await handleUpdate(
        pglite.db,
        reactionUpdate(42, 60, alice, thumbsUp, [], "2026-08-10T12:00:03.000Z"),
      );
      await handleUpdate(
        pglite.db,
        reactionUpdate(41, 60, alice, [], thumbsUp, "2026-08-10T12:00:00.000Z"),
      );

      const leaderboard = await queryLeaderboard(pglite.db, TEST_CHAT_ID, {
        year: 2026,
        month: 8,
      });
      expect(leaderboard.sections[0]?.entries ?? []).toEqual([]);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("keeps a Mark undone when the tap and untap fall in the same second", async () => {
    const pglite = await createPgliteDb();
    const alice = { id: 301, first_name: "Alice" };
    const thumbsUp: ReactionType[] = [{ type: "emoji", emoji: "👍" }];
    // Telegram timestamps are whole seconds, so a fast double-tap ties on date
    // and only the update_id says which came first.
    const sameSecond = "2026-08-10T12:00:00.000Z";

    try {
      await handleUpdate(
        pglite.db,
        messageUpdate(40, 60, { id: 201, first_name: "Bob", username: "bob" }),
      );

      await handleUpdate(
        pglite.db,
        reactionUpdate(42, 60, alice, thumbsUp, [], sameSecond),
      );
      await handleUpdate(
        pglite.db,
        reactionUpdate(41, 60, alice, [], thumbsUp, sameSecond),
      );

      await expect(liveMarks(pglite.db)).resolves.toEqual([]);
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
        handleUpdate(pglite.db, update),
        handleUpdate(pglite.db, update),
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

  it("credits a grace-window reaction to the message Season", async () => {
    const pglite = await createPgliteDb();

    try {
      await handleUpdate(
        pglite.db,
        messageUpdate(
          4,
          43,
          { id: 201, first_name: "Bob" },
          "2026-01-31T20:00:00.000Z",
        ),
      );
      await handleUpdate(
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

  it("removes a Registration when a member leaves", async () => {
    const pglite = await createPgliteDb();

    try {
      await pglite.db.insert(registrations).values({
        chatId: TEST_CHAT_ID,
        userId: 501,
      });

      await handleUpdate(
        pglite.db,
        chatMemberUpdate(11, { id: 501, first_name: "Dave" }, "left"),
      );

      const rows = await pglite.db.select().from(registrations);
      expect(rows).toHaveLength(0);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("rolls back the update claim when processing fails", async () => {
    const pglite = await createPgliteDb();

    try {
      await handleUpdate(
        pglite.db,
        messageUpdate(29, 999, { id: 201, first_name: "Bob" }),
      );
      const reaction = reactionUpdate(
        30,
        999,
        { id: 301, first_name: "Alice" },
        [],
        [{ type: "emoji", emoji: "👍" }],
      );

      // A real failure — the database going away mid-update, say — must leave
      // the update unclaimed so Telegram's retry genuinely re-processes it.
      const unreachable = unreachableAfterClaim(pglite.db);

      await expect(handleUpdate(unreachable, reaction)).rejects.toThrow(
        "database unreachable",
      );
      await expect(pglite.db.select().from(processedUpdates)).resolves.toEqual([
        { updateId: 29 },
      ]);

      await handleUpdate(
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
  describe("per-Chat Scoring reactions", () => {
    const alice = { id: 101, first_name: "Alice" };
    const bob = { id: 102, first_name: "Bob" };
    const clown: ReactionType[] = [{ type: "emoji", emoji: "🤡" }];
    const thumbsUp: ReactionType[] = [{ type: "emoji", emoji: "👍" }];

    it("scores by a custom emoji the Chat has bound", async () => {
      const pglite = await createPgliteDb();
      try {
        // The real order: /addreaction puts it in the palette, a save binds it.
        await addChatReaction(
          pglite.db,
          {
            chatId: TEST_CHAT_ID,
            reactionKey: "custom_emoji:9001",
            label: "🎉",
          },
          new Date("2026-08-01T00:00:00.000Z"),
        );
        await replaceChatBindings(
          pglite.db,
          TEST_CHAT_ID,
          new Map<string, MarkType>([["custom_emoji:9001", "humor.add"]]),
          new Date("2026-08-01T00:00:00.000Z"),
        );

        await handleUpdate(pglite.db, messageUpdate(1, 60, bob));
        await handleUpdate(
          pglite.db,
          reactionUpdate(
            2,
            60,
            alice,
            [],
            [{ type: "custom_emoji", custom_emoji_id: "9001" }],
          ),
        );

        await expect(liveMarks(pglite.db)).resolves.toMatchObject([
          { type: "humor.add", actorId: alice.id, subjectId: bob.id },
        ]);
      } finally {
        await closePgliteDb(pglite);
      }
    });

    it("stops scoring by a default the Chat has unbound", async () => {
      const pglite = await createPgliteDb();
      try {
        await addChatReaction(
          pglite.db,
          { chatId: TEST_CHAT_ID, reactionKey: "emoji:🤡", label: null },
          new Date("2026-08-01T00:00:00.000Z"),
        );
        await replaceChatBindings(
          pglite.db,
          TEST_CHAT_ID,
          new Map<string, MarkType>([["emoji:🤡", "karma.plus"]]),
          new Date("2026-08-01T00:00:00.000Z"),
        );

        await handleUpdate(pglite.db, messageUpdate(1, 60, bob));
        await handleUpdate(
          pglite.db,
          reactionUpdate(2, 60, alice, [], thumbsUp),
        );

        await expect(liveMarks(pglite.db)).resolves.toEqual([]);

        await handleUpdate(pglite.db, reactionUpdate(3, 60, alice, [], clown));

        await expect(liveMarks(pglite.db)).resolves.toMatchObject([
          { type: "karma.plus" },
        ]);
      } finally {
        await closePgliteDb(pglite);
      }
    });

    it("leaves a Chat that never configured anything on the defaults", async () => {
      const pglite = await createPgliteDb();
      try {
        await handleUpdate(pglite.db, messageUpdate(1, 60, bob));
        await handleUpdate(
          pglite.db,
          reactionUpdate(2, 60, alice, [], thumbsUp),
        );

        await expect(liveMarks(pglite.db)).resolves.toMatchObject([
          { type: "karma.plus" },
        ]);
      } finally {
        await closePgliteDb(pglite);
      }
    });
  });
  describe("/addreaction", () => {
    const alice = { id: 101, first_name: "Alice" };

    function addReactionUpdate(updateId: number, text = "/addreaction 🤡") {
      const update = messageUpdate(updateId, 60 + updateId, alice);

      return {
        ...update,
        message: {
          ...update.message,
          text,
          entities: [
            {
              offset: 0,
              length: (text.split(" ")[0] ?? "").length,
              type: "bot_command" as const,
            },
          ],
        },
      } as Update;
    }

    it("adds a reaction unbound, then says it is already there", async () => {
      const pglite = await createPgliteDb();
      try {
        const first = await handleUpdate(pglite.db, addReactionUpdate(1));
        expect(first.announcement).toMatchObject({
          kind: "ephemeral",
          receiverUserId: alice.id,
        });

        await expect(
          loadChatReactions(pglite.db, TEST_CHAT_ID),
        ).resolves.toEqual([
          { reactionKey: "emoji:🤡", markType: null, label: null },
        ]);

        const second = await handleUpdate(pglite.db, addReactionUpdate(2));
        expect(second.announcement?.text).not.toBe(first.announcement?.text);

        await expect(
          loadChatReactions(pglite.db, TEST_CHAT_ID),
        ).resolves.toHaveLength(1);
      } finally {
        await closePgliteDb(pglite);
      }
    });

    it("scores nothing until an administrator binds the reaction", async () => {
      const pglite = await createPgliteDb();
      try {
        await handleUpdate(pglite.db, addReactionUpdate(1));
        await handleUpdate(
          pglite.db,
          messageUpdate(2, 60, { id: 102, first_name: "Bob" }),
        );
        await handleUpdate(
          pglite.db,
          reactionUpdate(3, 60, alice, [], [{ type: "emoji", emoji: "🤡" }]),
        );

        // The palette row exists but binds nothing, so the reaction is inert.
        await expect(liveMarks(pglite.db)).resolves.toEqual([]);
      } finally {
        await closePgliteDb(pglite);
      }
    });

    it("answers a refusal without touching the palette", async () => {
      const pglite = await createPgliteDb();
      try {
        const handled = await handleUpdate(
          pglite.db,
          addReactionUpdate(1, "/addreaction 🍕"),
        );

        expect(handled.announcement).toMatchObject({ kind: "ephemeral" });
        await expect(
          loadChatReactions(pglite.db, TEST_CHAT_ID),
        ).resolves.toEqual([]);
      } finally {
        await closePgliteDb(pglite);
      }
    });
  });
});
