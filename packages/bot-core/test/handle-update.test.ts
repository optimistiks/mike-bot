import type { Update } from "grammy/types";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { PgliteDatabase } from "#src/db/pglite.js";
import type { HandlerResult } from "#src/outcomes.js";

import { SINGLE_COUNT } from "#src/constants.js";
import { gatewayConversationModel } from "#src/conversation/model.js";
import { closePgliteDb, createPgliteDb } from "#src/db/pglite.js";
import {
  isConversationOpen,
  markExists,
  openConversationAssistantTurns,
  openConversationMemberTurns,
  openConversationParticipantIds,
} from "#src/db/queries.js";
import { handleUpdate } from "#src/handle-update.js";

import { ALICE, BOB, BOT_USER, CAROL, CHAT_ID, statsUpdate, textUpdate } from "./helpers.js";
import {
  capturedModelBodies,
  enqueueModelTexts,
  holdNextModelResponse,
  liveLabeledTurnTextsFromLastModelBody,
  liveLabeledTurnTextsFromPreviousModelBody,
  modelServer,
  resetCapturedModelBodies,
  waitUntilModelCallCount,
} from "./msw.js";

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

  it("wakes on бот and бот привет with labeled whole text", async () => {
    expect.hasAssertions();
    await freshDb();

    const bare = await handle(
      textUpdate({
        from: ALICE,
        messageId: 70,
        text: "бот",
        updateId: 1,
      }),
    );
    const withRest = await handle(
      textUpdate({
        from: ALICE,
        messageId: 71,
        text: "бот привет",
        updateId: 2,
      }),
    );

    expect(bare).toStrictEqual({ kind: "reply", text: "че", type: "conversation" });
    expect(withRest).toStrictEqual({ kind: "reply", text: "че", type: "conversation" });
    expect(liveLabeledTurnTextsFromLastModelBody()).toStrictEqual([
      "[Alice] бот",
      "[Alice] бот привет",
    ]);
    await expect(isConversationOpen(currentDb().db, { chatId: CHAT_ID })).resolves.toBe(true);
    await expect(
      openConversationParticipantIds(currentDb().db, { chatId: CHAT_ID }),
    ).resolves.toStrictEqual([ALICE.id]);
  });

  it("keeps later text without бот as a Turn with prior labeled history", async () => {
    expect.hasAssertions();
    await freshDb();

    await handle(
      textUpdate({
        from: ALICE,
        messageId: 72,
        text: "бот",
        updateId: 1,
      }),
    );
    const result = await handle(
      textUpdate({
        from: ALICE,
        messageId: 73,
        text: "как дела",
        updateId: 2,
      }),
    );

    expect(result).toStrictEqual({ kind: "reply", text: "че", type: "conversation" });
    expect(liveLabeledTurnTextsFromLastModelBody()).toStrictEqual([
      "[Alice] бот",
      "[Alice] как дела",
    ]);
    await expect(
      openConversationMemberTurns(currentDb().db, { chatId: CHAT_ID }),
    ).resolves.toStrictEqual(["[Alice] бот", "[Alice] как дела"]);
  });

  it("closes on довольно and stays silent afterwards", async () => {
    expect.hasAssertions();
    await freshDb();

    await handle(
      textUpdate({
        from: ALICE,
        messageId: 74,
        text: "бот",
        updateId: 1,
      }),
    );
    const stopped = await handle(
      textUpdate({
        from: ALICE,
        messageId: 75,
        text: "довольно",
        updateId: 2,
      }),
    );
    const later = await handle(
      textUpdate({
        from: ALICE,
        messageId: 76,
        text: "ещё слово",
        updateId: 3,
      }),
    );

    expect(stopped).toStrictEqual({ kind: "closed", type: "conversation" });
    expect(later).toStrictEqual({ kind: "silence", type: "conversation" });
    await expect(isConversationOpen(currentDb().db, { chatId: CHAT_ID })).resolves.toBe(false);
    await expect(
      openConversationParticipantIds(currentDb().db, { chatId: CHAT_ID }),
    ).resolves.toStrictEqual([]);
  });

  it("accepts Scoring during a Conversation and lets a second Member join the same one", async () => {
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
    const scoring = await handle(
      textUpdate({
        from: ALICE,
        messageId: 81,
        replyTo: { from: BOB, messageId: 12 },
        text: "+",
        updateId: 2,
      }),
    );
    const joined = await handle(
      textUpdate({
        from: BOB,
        messageId: 82,
        text: "бот ку",
        updateId: 3,
      }),
    );

    expect(scoring).toStrictEqual({
      kind: "accepted",
      text: "➕ (alice)",
      type: "scoring",
    });
    expect(joined).toStrictEqual({ kind: "reply", text: "че", type: "conversation" });
    await expect(
      openConversationMemberTurns(currentDb().db, { chatId: CHAT_ID }),
    ).resolves.toStrictEqual(["[Alice] бот привет", "[Bob] бот ку"]);
    await expect(
      openConversationParticipantIds(currentDb().db, { chatId: CHAT_ID }),
    ).resolves.toStrictEqual([ALICE.id, BOB.id]);
    expect(liveLabeledTurnTextsFromLastModelBody()).toStrictEqual([
      "[Alice] бот привет",
      "[Bob] бот ку",
    ]);
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
    expect(liveLabeledTurnTextsFromLastModelBody()).toStrictEqual(["[Alice] бот"]);
  });

  it("logs bystander text without a reply and includes it in the next completion", async () => {
    expect.hasAssertions();
    await freshDb();

    await handle(
      textUpdate({
        from: ALICE,
        messageId: 91,
        text: "бот",
        updateId: 1,
      }),
    );
    const bystander = await handle(
      textUpdate({
        from: BOB,
        messageId: 92,
        text: "он опять сломался",
        updateId: 2,
      }),
    );
    const next = await handle(
      textUpdate({
        from: ALICE,
        messageId: 93,
        text: "видишь",
        updateId: 3,
      }),
    );

    expect(bystander).toStrictEqual({ kind: "silence", type: "conversation" });
    expect(next).toStrictEqual({ kind: "reply", text: "че", type: "conversation" });
    await expect(
      openConversationParticipantIds(currentDb().db, { chatId: CHAT_ID }),
    ).resolves.toStrictEqual([ALICE.id]);
    expect(liveLabeledTurnTextsFromLastModelBody()).toStrictEqual([
      "[Alice] бот",
      "[Bob] он опять сломался",
      "[Alice] видишь",
    ]);
  });

  it("joins a second Member into the already open Conversation", async () => {
    expect.hasAssertions();
    await freshDb();

    await handle(
      textUpdate({
        from: ALICE,
        messageId: 94,
        text: "бот привет",
        updateId: 1,
      }),
    );
    const joined = await handle(
      textUpdate({
        from: BOB,
        messageId: 95,
        text: "бот ку",
        updateId: 2,
      }),
    );

    expect(joined).toStrictEqual({ kind: "reply", text: "че", type: "conversation" });
    await expect(
      openConversationParticipantIds(currentDb().db, { chatId: CHAT_ID }),
    ).resolves.toStrictEqual([ALICE.id, BOB.id]);
    expect(liveLabeledTurnTextsFromLastModelBody()).toStrictEqual([
      "[Alice] бот привет",
      "[Bob] бот ку",
    ]);
  });

  it("stays silent on empty model text and stores no assistant Turn", async () => {
    expect.hasAssertions();
    await freshDb();

    await handle(
      textUpdate({
        from: ALICE,
        messageId: 96,
        text: "бот",
        updateId: 1,
      }),
    );
    enqueueModelTexts(["   "]);
    const result = await handle(
      textUpdate({
        from: ALICE,
        messageId: 97,
        text: "как дела",
        updateId: 2,
      }),
    );

    expect(result).toStrictEqual({ kind: "silence", type: "conversation" });
    await expect(
      openConversationAssistantTurns(currentDb().db, { chatId: CHAT_ID }),
    ).resolves.toStrictEqual(["че"]);
  });

  it("lets Bob complete while Alice's completion is in flight", async () => {
    expect.hasAssertions();
    await freshDb();

    await handle(
      textUpdate({
        from: ALICE,
        messageId: 98,
        text: "бот",
        updateId: 1,
      }),
    );
    await handle(
      textUpdate({
        from: BOB,
        messageId: 99,
        text: "бот",
        updateId: 2,
      }),
    );
    const release = holdNextModelResponse();
    const inFlightCount = capturedModelBodies.length + SINGLE_COUNT;
    const alicePending = handle(
      textUpdate({
        from: ALICE,
        messageId: 100,
        text: "как дела",
        updateId: 3,
      }),
    );
    await waitUntilModelCallCount(inFlightCount);
    const bob = await handle(
      textUpdate({
        from: BOB,
        messageId: 101,
        text: "ку",
        updateId: 4,
      }),
    );
    release();
    const alice = await alicePending;

    expect(bob).toStrictEqual({ kind: "reply", text: "че", type: "conversation" });
    expect(alice).toStrictEqual({ kind: "reply", text: "че", type: "conversation" });
  });

  it("retries a banned phrase and never posts the banned span", async () => {
    expect.hasAssertions();
    await freshDb();

    await handle(
      textUpdate({
        from: ALICE,
        messageId: 104,
        text: "бот",
        updateId: 1,
      }),
    );
    enqueueModelTexts(["ну я пошутил конечно", "че"]);
    const callsBefore = capturedModelBodies.length;
    const result = await handle(
      textUpdate({
        from: ALICE,
        messageId: 105,
        text: "шутка",
        updateId: 2,
      }),
    );

    expect(result).toStrictEqual({ kind: "reply", text: "че", type: "conversation" });
    expect(capturedModelBodies.length - callsBefore).toBe(SINGLE_COUNT + SINGLE_COUNT);
    expect(liveLabeledTurnTextsFromLastModelBody()).toStrictEqual(
      liveLabeledTurnTextsFromPreviousModelBody(),
    );
    expect(liveLabeledTurnTextsFromLastModelBody().join("\n")).not.toMatch(/я пошутил/iu);
  });
});
