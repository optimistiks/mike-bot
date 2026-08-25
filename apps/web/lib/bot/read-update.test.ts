import { describe, expect, it } from "vitest";
import type { ReactionType, Update } from "grammy/types";

import { DEFAULT_SCORING_REACTIONS, type ScoringReactionMap } from "./emojis";
import {
  type CachedMessage,
  messageDisplayIdentities,
  readUpdate,
} from "./read-update";

const CHAT_ID = -100_111_222;
const BOT_USERNAME = "mike_bot";
const AUTHOR = { id: 201, is_bot: false, first_name: "Bob", username: "bob" };
const ACTOR = { id: 301, is_bot: false, first_name: "Alice" };

const AUGUST_MESSAGE = Math.floor(
  new Date("2026-08-10T11:00:00.000Z").getTime() / 1000,
);
const AUGUST_REACTION = Math.floor(
  new Date("2026-08-10T12:00:00.000Z").getTime() / 1000,
);

function read(
  update: Update,
  cached: CachedMessage | null = null,
  bindings: ScoringReactionMap = DEFAULT_SCORING_REACTIONS,
) {
  return readUpdate(update, { cachedMessage: cached, bindings }, BOT_USERNAME);
}

function messageUpdate(overrides: Record<string, unknown> = {}): Update {
  return {
    update_id: 1,
    message: {
      message_id: 60,
      date: AUGUST_MESSAGE,
      chat: { id: CHAT_ID, type: "supergroup", title: "Test" },
      from: AUTHOR,
      text: "hello",
      ...overrides,
    },
  };
}

function reactionUpdate(
  newReaction: ReactionType[] = [{ type: "emoji", emoji: "👍" }],
  overrides: Record<string, unknown> = {},
): Update {
  return {
    update_id: 2,
    message_reaction: {
      chat: { id: CHAT_ID, type: "supergroup", title: "Test" },
      message_id: 60,
      user: ACTOR,
      date: AUGUST_REACTION,
      old_reaction: [],
      new_reaction: newReaction,
      ...overrides,
    },
  };
}

function chatMemberUpdate(
  status: "member" | "left",
  overrides: Record<string, unknown> = {},
): Update {
  return {
    update_id: 3,
    chat_member: {
      chat: { id: CHAT_ID, type: "supergroup", title: "Test" },
      from: { id: 999, is_bot: false, first_name: "Admin" },
      date: AUGUST_MESSAGE,
      old_chat_member: {
        status: status === "member" ? "left" : "member",
        user: ACTOR,
      },
      new_chat_member: { status, user: ACTOR },
      ...overrides,
    },
  };
}

const CACHED = {
  authorId: AUTHOR.id,
  authorIsBot: false,
  messageDate: AUGUST_MESSAGE,
};

function writesNothing(facts: ReturnType<typeof readUpdate>): boolean {
  return (
    facts.messages.length === 0 &&
    facts.identities.length === 0 &&
    facts.markChanges === null &&
    facts.addRegistration === null &&
    facts.removeRegistration === null &&
    facts.addReaction === null
  );
}

describe("messageDisplayIdentities", () => {
  it("names the Members in a fixed order whichever way the reply goes", () => {
    const alice = { id: 10, is_bot: false, first_name: "Alice" };
    const bob = { id: 20, is_bot: false, first_name: "Bob" };

    expect(
      messageDisplayIdentities({
        from: bob,
        reply_to_message: { from: alice },
      }).map((member) => member.id),
    ).toEqual([10, 20]);
    expect(
      messageDisplayIdentities({
        from: alice,
        reply_to_message: { from: bob },
      }).map((member) => member.id),
    ).toEqual([10, 20]);
  });

  it("names a Member once when they reply to themselves", () => {
    const alice = { id: 10, is_bot: false, first_name: "Alice" };

    expect(
      messageDisplayIdentities({
        from: alice,
        reply_to_message: { from: alice },
      }),
    ).toHaveLength(1);
  });
});

describe("readUpdate", () => {
  describe("writes nothing", () => {
    it.each([
      [
        "a private message",
        messageUpdate({
          chat: { id: CHAT_ID, type: "private", first_name: "Bob" },
        }),
        null,
      ],
      [
        "the Stats command sent privately",
        messageUpdate({
          chat: { id: CHAT_ID, type: "private", first_name: "Bob" },
          text: "/stats",
          entities: [{ offset: 0, length: 6, type: "bot_command" }],
        }),
        null,
      ],
      [
        "a channel post",
        messageUpdate({
          chat: { id: CHAT_ID, type: "channel", title: "Test" },
        }),
        null,
      ],
      [
        "a chat-member update in a private chat",
        chatMemberUpdate("left", {
          chat: { id: CHAT_ID, type: "private", first_name: "Bob" },
        }),
        null,
      ],
      [
        "a private reaction",
        reactionUpdate(undefined, {
          chat: { id: CHAT_ID, type: "private", first_name: "Bob" },
        }),
        CACHED,
      ],
      ["a reaction on a Message nobody cached", reactionUpdate(), null],
      [
        "a reaction on a bot-authored Message",
        reactionUpdate(),
        { ...CACHED, authorIsBot: true },
      ],
      [
        "a reaction carrying an unreadable timestamp",
        reactionUpdate(undefined, { date: Number.NaN }),
        CACHED,
      ],
      [
        "a reaction from the Subject on their own Message",
        reactionUpdate(undefined, { user: { ...ACTOR, id: AUTHOR.id } }),
        CACHED,
      ],
      [
        "a reaction from a bot",
        reactionUpdate(undefined, { user: { ...ACTOR, is_bot: true } }),
        CACHED,
      ],
      [
        "a reaction carrying no scoring emoji",
        reactionUpdate([{ type: "emoji", emoji: "🎉" }]),
        CACHED,
      ],
      [
        "a reaction once the Message's Season has closed",
        reactionUpdate(undefined, {
          date: Math.floor(
            new Date("2026-09-01T00:00:00.000Z").getTime() / 1000,
          ),
        }),
        {
          ...CACHED,
          messageDate: Math.floor(
            new Date("2026-07-15T12:00:00.000Z").getTime() / 1000,
          ),
        },
      ],
    ])("for %s", (_case, update, cached) => {
      const facts = read(update, cached);

      expect(writesNothing(facts)).toBe(true);
      expect(facts.announcement).toBeNull();
      expect(facts.acknowledgement).toBeNull();
    });
  });

  describe("in a plain group", () => {
    const group = { id: CHAT_ID, type: "group", title: "Test" };

    it("caches Messages and mirrors the Chat, as in a supergroup", () => {
      const facts = read(messageUpdate({ chat: group }));

      expect(facts.metadata).toMatchObject({ chat: group });
      expect(facts.messages).toHaveLength(1);
      expect(facts.identities).toHaveLength(1);
    });

    it("places a Mark from a Scoring reply", () => {
      const facts = read(
        messageUpdate({
          chat: group,
          message_id: 61,
          from: ACTOR,
          text: "+",
          reply_to_message: {
            message_id: 60,
            date: AUGUST_MESSAGE,
            chat: group,
            from: AUTHOR,
          },
        }),
      );

      expect(facts.markChanges).toMatchObject({
        identity: { chatId: CHAT_ID, actorId: ACTOR.id, subjectId: AUTHOR.id },
        source: "reply",
      });
    });

    it("places a Mark from a Scoring reaction", () => {
      const facts = read(reactionUpdate(undefined, { chat: group }), CACHED);

      expect(facts.markChanges).toMatchObject({
        changes: [{ action: "add", type: "karma.plus" }],
        source: "reaction",
      });
    });

    it("drops a Registration when a Member leaves", () => {
      const facts = read(chatMemberUpdate("left", { chat: group }));

      expect(facts.removeRegistration).toEqual({
        chatId: CHAT_ID,
        userId: ACTOR.id,
      });
    });

    it("writes nothing for an upgrade, leaving history under the old id", () => {
      const facts = read(
        messageUpdate({ chat: group, migrate_to_chat_id: -100_999 }),
      );

      expect(writesNothing(facts)).toBe(true);
      expect(facts.skipped?.reason).toContain("upgrade");
    });
  });

  it("does not cache a Scoring reply as a markable Message", () => {
    const facts = read(
      messageUpdate({
        message_id: 61,
        text: "+",
        reply_to_message: {
          message_id: 60,
          date: AUGUST_MESSAGE,
          chat: { id: CHAT_ID, type: "supergroup", title: "Test" },
          from: ACTOR,
        },
      }),
    );

    // The reply itself is never a Message; the Message it answers is.
    expect(facts.messages.map((message) => message.messageId)).toEqual([60]);
    expect(facts.markChanges).toMatchObject({
      identity: { messageId: 60 },
      source: "reply",
    });
    expect(facts.acknowledgement).toMatchObject({
      kind: "scoring-reply",
      deleteMessageId: 61,
      replyToMessageId: 60,
    });
  });

  it("does not cache an ephemeral command message", () => {
    const facts = read(
      messageUpdate({ ephemeral_message_id: 5, text: "/stats" }),
    );

    expect(facts.messages).toEqual([]);
  });

  it("caches a bot-authored Message without a Display identity", () => {
    const facts = read(
      messageUpdate({ from: { id: 777, is_bot: true, first_name: "Mike" } }),
    );

    expect(facts.messages).toHaveLength(1);
    expect(facts.identities).toEqual([]);
  });

  it("refuses a Scoring reply to a forum topic's opening message", () => {
    const facts = read(
      messageUpdate({
        message_id: 61,
        text: "+",
        reply_to_message: {
          message_id: 1,
          date: AUGUST_MESSAGE,
          chat: { id: CHAT_ID, type: "supergroup", title: "Test" },
          from: ACTOR,
          forum_topic_created: { name: "Topic", icon_color: 0 },
        },
      }),
    );

    expect(facts.markChanges).toBeNull();
    expect(facts.acknowledgement).toBeNull();
  });

  it.each(["/stats", "/register", `/stats@${BOT_USERNAME}`])(
    "registers the caller and answers %s",
    (command) => {
      const facts = read(
        messageUpdate({
          text: command,
          entities: [
            { offset: 0, length: command.length, type: "bot_command" },
          ],
        }),
      );

      expect(facts.addRegistration).toEqual({
        chatId: CHAT_ID,
        userId: AUTHOR.id,
      });
      expect(facts.announcement).toMatchObject({
        kind: "stats",
        receiverUserId: AUTHOR.id,
        url: `https://t.me/${BOT_USERNAME}?startapp=chat_${String(CHAT_ID)}`,
      });
    },
  );

  describe("/addreaction", () => {
    function addReaction(text: string, entities: unknown[] = []) {
      return read(
        messageUpdate({
          text,
          entities: [
            {
              offset: 0,
              length: (text.split(" ")[0] ?? "").length,
              type: "bot_command",
            },
            ...entities,
          ],
        }),
      );
    }

    it("puts the reaction in the palette bound to nothing", () => {
      const facts = addReaction("/addreaction 🤡");

      expect(facts.addReaction).toMatchObject({
        chatId: CHAT_ID,
        reactionKey: "emoji:🤡",
        label: null,
      });
      // Binding is the Mini App's job; the command never places a Mark.
      expect(facts.markChanges).toBeNull();
      expect(facts.addRegistration).toBeNull();
    });

    it("names who to answer, and leaves the wording to the write", () => {
      const facts = addReaction("/addreaction 🤡");

      // Whether this added a reaction or repeated one is something only the
      // write finds out, so no answer travels with the fact.
      expect(facts.addReaction?.receiverUserId).toBe(AUTHOR.id);
      expect(facts.announcement).toBeNull();
    });

    it("reads a custom emoji from its entity", () => {
      const facts = addReaction("/addreaction 🎉", [
        {
          type: "custom_emoji",
          offset: 13,
          length: 2,
          custom_emoji_id: "9001",
        },
      ]);

      expect(facts.addReaction).toMatchObject({
        reactionKey: "custom_emoji:9001",
        label: "🎉",
      });
    });

    it("answers a refusal ephemerally and writes nothing", () => {
      const facts = addReaction("/addreaction 🍕");

      expect(facts.addReaction).toBeNull();
      expect(facts.announcement).toMatchObject({
        kind: "ephemeral",
        receiverUserId: AUTHOR.id,
      });
      expect(facts.markChanges).toBeNull();
    });

    it("is not a Scoring reply, whatever the argument looks like", () => {
      expect(addReaction("/addreaction 👍").markChanges).toBeNull();
    });
  });

  it("does not read a command that is only mentioned mid-sentence", () => {
    const facts = read(messageUpdate({ text: "try /stats sometime" }));

    expect(facts.addRegistration).toBeNull();
    expect(facts.announcement).toBeNull();
  });

  it("does not register a Member merely for joining", () => {
    const facts = read(chatMemberUpdate("member"));

    // Joining is not Registration: that begins with the Stats command. The
    // Member is still worth naming, so their Display identity is touched.
    expect(facts.addRegistration).toBeNull();
    expect(facts.removeRegistration).toBeNull();
    expect(facts.identities).toEqual([
      { chatId: CHAT_ID, userId: ACTOR.id, displayName: "Alice" },
    ]);
  });

  it("drops the Registration of a Member who leaves", () => {
    const facts = read(chatMemberUpdate("left"));

    expect(facts.removeRegistration).toEqual({
      chatId: CHAT_ID,
      userId: ACTOR.id,
    });
  });

  it("orders a reaction switch as removal before addition", () => {
    const facts = read(
      reactionUpdate([{ type: "emoji", emoji: "👎" }], {
        old_reaction: [{ type: "emoji", emoji: "👍" }],
      }),
      CACHED,
    );

    expect(facts.markChanges?.changes).toEqual([
      { action: "remove", type: "karma.plus" },
      { action: "add", type: "karma.minus" },
    ]);
  });
});
