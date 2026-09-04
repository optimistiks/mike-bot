import type { Update } from "grammy/types";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { PgliteDatabase } from "#src/bot/db/pglite.js";
import type { HandlerResult } from "#src/bot/outcomes.js";

import { gatewayConversationModel } from "#src/bot/conversation/model.js";
import { closePgliteDb, createPgliteDb } from "#src/bot/db/pglite.js";
import {
  isConversationOpen,
  markExists,
  openConversationMemberTurns,
} from "#src/bot/db/queries.js";
import { handleUpdate } from "#src/bot/handle-update.js";

import { ALICE, BOB, BOT_USER, CAROL, CHAT_ID, statsUpdate, textUpdate } from "./helpers.js";
import { modelServer, resetCapturedModelBodies, userTurnTextsFromModelBodies } from "./msw.js";

const STANDINGS_UPDATE_ID = 8;
const EMPTY_STATS_UPDATE_ID = 1;

describe("telegram update handling", () => {
  // eslint-disable-next-line init-declarations -- assigned in freshDb
  let database: PgliteDatabase | undefined;

  beforeAll(() => {
    modelServer.listen({ onUnhandledRequest: "error" });
  });

  function currentDb(): PgliteDatabase {
    if (database === undefined) {
      throw new Error("database is unset");
    }
    return database;
  }

  function handle(update: Update): Promise<HandlerResult> {
    return handleUpdate(update, {
      db: currentDb().db,
      model: gatewayConversationModel,
    });
  }

  async function freshDb(): Promise<void> {
    database = await createPgliteDb();
  }

  afterEach(async () => {
    resetCapturedModelBodies();
    modelServer.resetHandlers();
    if (database !== undefined) {
      await closePgliteDb(database);
    }
  });

  afterAll(() => {
    modelServer.close();
  });

  it("accepts a + Scoring reply, stores the Mark, and answers with ➕ (name)", async () => {
    expect.hasAssertions();
    await freshDb();

    const result = await handle(
      textUpdate({
        from: ALICE,
        messageId: 50,
        replyTo: { from: BOB, messageId: 10 },
        text: " + ",
        updateId: 1,
      }),
    );

    expect(result).toStrictEqual({
      kind: "accepted",
      text: "➕ (alice)",
      type: "scoring",
    });
    await expect(
      markExists(currentDb().db, {
        actorId: ALICE.id,
        chatId: CHAT_ID,
        messageId: 10,
        type: "karma.plus",
      }),
    ).resolves.toBe(true);
  });

  it("accepts лол as a Humor Mark regardless of case", async () => {
    expect.hasAssertions();
    await freshDb();

    const result = await handle(
      textUpdate({
        from: ALICE,
        messageId: 51,
        replyTo: { from: BOB, messageId: 10 },
        text: "ЛОЛ",
        updateId: 1,
      }),
    );

    expect(result).toStrictEqual({
      kind: "accepted",
      text: "лол (alice)",
      type: "scoring",
    });
    await expect(
      markExists(currentDb().db, {
        actorId: ALICE.id,
        chatId: CHAT_ID,
        messageId: 10,
        type: "humor.add",
      }),
    ).resolves.toBe(true);
  });

  it("ignores self-scoring, bot Subjects, and a missing reply", async () => {
    expect.hasAssertions();
    await freshDb();

    const self = await handle(
      textUpdate({
        from: ALICE,
        messageId: 52,
        replyTo: { from: ALICE, messageId: 10 },
        text: "+",
        updateId: 1,
      }),
    );
    const botSubject = await handle(
      textUpdate({
        from: ALICE,
        messageId: 53,
        replyTo: { from: BOT_USER, messageId: 11 },
        text: "+",
        updateId: 2,
      }),
    );
    const missing = await handle(
      textUpdate({
        from: ALICE,
        messageId: 54,
        text: "+",
        updateId: 3,
      }),
    );

    expect(self).toStrictEqual({ kind: "ignored", type: "scoring" });
    expect(botSubject).toStrictEqual({ kind: "ignored", type: "scoring" });
    expect(missing).toStrictEqual({ kind: "ignored", type: "scoring" });
    await expect(
      markExists(currentDb().db, {
        actorId: ALICE.id,
        chatId: CHAT_ID,
        messageId: 10,
        type: "karma.plus",
      }),
    ).resolves.toBe(false);
    await expect(
      markExists(currentDb().db, {
        actorId: ALICE.id,
        chatId: CHAT_ID,
        messageId: 11,
        type: "karma.plus",
      }),
    ).resolves.toBe(false);
  });

  it("ignores a second + on the same Message and leaves the token", async () => {
    expect.hasAssertions();
    await freshDb();

    await handle(
      textUpdate({
        from: ALICE,
        messageId: 55,
        replyTo: { from: BOB, messageId: 10 },
        text: "+",
        updateId: 1,
      }),
    );
    const result = await handle(
      textUpdate({
        from: ALICE,
        messageId: 56,
        replyTo: { from: BOB, messageId: 10 },
        text: "+",
        updateId: 2,
      }),
    );

    expect(result).toStrictEqual({ kind: "ignored", type: "scoring" });
  });

  it("posts v1 Standings Markdown for a Chat with Marks", async () => {
    expect.hasAssertions();
    await freshDb();

    await handle(
      textUpdate({
        from: BOB,
        messageId: 61,
        replyTo: { from: ALICE, messageId: 10 },
        text: "+",
        updateId: 1,
      }),
    );
    await handle(
      textUpdate({
        from: CAROL,
        messageId: 62,
        replyTo: { from: ALICE, messageId: 11 },
        text: "+",
        updateId: 2,
      }),
    );
    await handle(
      textUpdate({
        from: ALICE,
        messageId: 63,
        replyTo: { from: BOB, messageId: 12 },
        text: "+",
        updateId: 3,
      }),
    );
    await handle(
      textUpdate({
        from: ALICE,
        messageId: 64,
        replyTo: { from: CAROL, messageId: 13 },
        text: "-",
        updateId: 4,
      }),
    );
    await handle(
      textUpdate({
        from: BOB,
        messageId: 65,
        replyTo: { from: ALICE, messageId: 10 },
        text: "лол",
        updateId: 5,
      }),
    );
    await handle(
      textUpdate({
        from: CAROL,
        messageId: 66,
        replyTo: { from: ALICE, messageId: 11 },
        text: "лол",
        updateId: 6,
      }),
    );
    await handle(
      textUpdate({
        from: ALICE,
        messageId: 67,
        replyTo: { from: CAROL, messageId: 13 },
        text: "лол",
        updateId: 7,
      }),
    );

    const result = await handle(statsUpdate(STANDINGS_UPDATE_ID, ALICE));

    expect(result).toStrictEqual({
      kind: "posted",
      text: [
        "*Уважаемые люди:*",
        "alice: 2 👑",
        "bob: 1 ",
        "carol: -1 🐔",
        "",
        "*Юмористы:*",
        "alice: 1 👑",
        "carol: 1 👑",
        "bob: 0 🐔",
        "",
        "*Поставили ➕:*",
        "alice: 1",
        "bob: 1",
        "carol: 1",
        "",
        "*Поставили ➖:*",
        "alice: 1",
        "bob: 0",
        "carol: 0",
        "",
        "*Поставили лол:*",
        "alice: 1",
        "bob: 1",
        "carol: 1",
        "",
      ].join("\n"),
      type: "standings",
    });
  });

  it("leaves /stats untouched in a Chat with no Marks", async () => {
    expect.hasAssertions();
    await freshDb();

    const result = await handle(statsUpdate(EMPTY_STATS_UPDATE_ID, ALICE));

    expect(result).toStrictEqual({ kind: "empty", type: "standings" });
  });

  it("opens a Conversation on бот and sends that text as-is to the model", async () => {
    expect.hasAssertions();
    await freshDb();

    const result = await handle(
      textUpdate({
        from: ALICE,
        messageId: 70,
        text: "бот",
        updateId: 1,
      }),
    );

    expect(result).toStrictEqual({ kind: "reply", text: "че", type: "conversation" });
    expect(userTurnTextsFromModelBodies()).toStrictEqual(["бот"]);
    await expect(
      isConversationOpen(currentDb().db, {
        chatId: CHAT_ID,
        memberId: ALICE.id,
      }),
    ).resolves.toBe(true);
  });

  it("keeps later text without бот as a Turn with prior history", async () => {
    expect.hasAssertions();
    await freshDb();

    await handle(
      textUpdate({
        from: ALICE,
        messageId: 71,
        text: "бот",
        updateId: 1,
      }),
    );
    const result = await handle(
      textUpdate({
        from: ALICE,
        messageId: 72,
        text: "как дела",
        updateId: 2,
      }),
    );

    expect(result).toStrictEqual({ kind: "reply", text: "че", type: "conversation" });
    expect(userTurnTextsFromModelBodies()).toStrictEqual(["бот", "бот", "как дела"]);
    await expect(
      openConversationMemberTurns(currentDb().db, {
        chatId: CHAT_ID,
        memberId: ALICE.id,
      }),
    ).resolves.toStrictEqual(["бот", "как дела"]);
  });

  it("closes on довольно and stays silent afterwards", async () => {
    expect.hasAssertions();
    await freshDb();

    await handle(
      textUpdate({
        from: ALICE,
        messageId: 73,
        text: "бот",
        updateId: 1,
      }),
    );
    const stopped = await handle(
      textUpdate({
        from: ALICE,
        messageId: 74,
        text: "довольно",
        updateId: 2,
      }),
    );
    const later = await handle(
      textUpdate({
        from: ALICE,
        messageId: 75,
        text: "ещё слово",
        updateId: 3,
      }),
    );

    expect(stopped).toStrictEqual({ kind: "silence", type: "conversation" });
    expect(later).toStrictEqual({ kind: "silence", type: "conversation" });
    await expect(
      isConversationOpen(currentDb().db, {
        chatId: CHAT_ID,
        memberId: ALICE.id,
      }),
    ).resolves.toBe(false);
  });

  it("isolates two Members in one Chat and still accepts Scoring during a Conversation", async () => {
    expect.hasAssertions();
    await freshDb();

    await handle(
      textUpdate({
        from: ALICE,
        messageId: 80,
        text: "бот привет",
        updateId: 1,
      }),
    );
    await handle(
      textUpdate({
        from: BOB,
        messageId: 81,
        text: "бот ку",
        updateId: 2,
      }),
    );
    const scoring = await handle(
      textUpdate({
        from: ALICE,
        messageId: 82,
        replyTo: { from: BOB, messageId: 12 },
        text: "+",
        updateId: 3,
      }),
    );

    expect(scoring).toStrictEqual({
      kind: "accepted",
      text: "➕ (alice)",
      type: "scoring",
    });
    await expect(
      openConversationMemberTurns(currentDb().db, {
        chatId: CHAT_ID,
        memberId: ALICE.id,
      }),
    ).resolves.toStrictEqual(["бот привет"]);
    await expect(
      openConversationMemberTurns(currentDb().db, {
        chatId: CHAT_ID,
        memberId: BOB.id,
      }),
    ).resolves.toStrictEqual(["бот ку"]);
    expect(userTurnTextsFromModelBodies()).toStrictEqual(["бот привет", "бот ку"]);
  });

  it("ignores a second delivery of the same update_id", async () => {
    expect.hasAssertions();
    await freshDb();

    const update = textUpdate({
      from: ALICE,
      messageId: 90,
      text: "бот",
      updateId: 1,
    });
    const first = await handle(update);
    const retry = await handle(update);

    expect(first).toStrictEqual({ kind: "reply", text: "че", type: "conversation" });
    expect(retry).toStrictEqual({ type: "noop" });
    expect(userTurnTextsFromModelBodies()).toStrictEqual(["бот"]);
  });
});
