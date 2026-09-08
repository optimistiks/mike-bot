import type { Update } from "grammy/types";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { PgliteDatabase } from "#src/db/pglite.js";
import type { HandlerResult } from "#src/outcomes.js";

import { SINGLE_COUNT } from "#src/constants.js";
import { gatewayConversationModel } from "#src/conversation/model.js";
import { closePgliteDb, createPgliteDb } from "#src/db/pglite.js";
import {
  chatConversationMemberTurns,
  chatConversationTurnCount,
  isConversationOpen,
  markExists,
  openConversationAssistantTurns,
  openConversationMemberTurns,
  openConversationParticipantIds,
} from "#src/db/queries.js";
import { handleUpdate } from "#src/handle-update.js";

import { ALICE, BOB, BOT_USER, CAROL, CHAT_ID, LENA, statsUpdate, textUpdate } from "./helpers.js";
import {
  assistantTurnTextsFromLastModelBody,
  capturedModelBodies,
  enqueueModelTexts,
  holdNextModelResponse,
  lastCapturedModelBodyJson,
  liveLabeledTurnTextsFromLastModelBody,
  liveLabeledTurnTextsFromPreviousModelBody,
  modelServer,
  resetCapturedModelBodies,
  waitUntilModelCallCount,
} from "./msw.js";

const STANDINGS_UPDATE_ID = 8;
const EMPTY_STATS_UPDATE_ID = 1;
const CLOSED_TURN_WINDOW = 100;
const ZERO_AGE = "0 сек. назад";
const TWO_HOURS_SECONDS = 7200;

function liveLabeled(handle: string, text: string, age = ZERO_AGE): string {
  return `[${handle}][${age}] ${text}`;
}

function numberedTexts(prefix: string, count: number): string[] {
  const texts: string[] = [];
  for (let index = SINGLE_COUNT; index <= count; index += SINGLE_COUNT) {
    texts.push(`${prefix} ${String(index)}`);
  }
  return texts;
}

function silenceResults(count: number): HandlerResult[] {
  return Array.from({ length: count }, () => ({
    kind: "silence" as const,
    type: "conversation" as const,
  }));
}

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

  async function handleNumberedTexts(
    from: typeof ALICE,
    texts: string[],
    firstId: number,
  ): Promise<HandlerResult[]> {
    const [text, ...rest] = texts;
    if (text === undefined) {
      return [];
    }
    const result = await handle(
      textUpdate({
        from,
        messageId: firstId,
        text,
        updateId: firstId,
      }),
    );
    const following = await handleNumberedTexts(from, rest, firstId + SINGLE_COUNT);
    return [result, ...following];
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
      liveLabeled("alice", "бот"),
      liveLabeled("alice", "бот привет"),
    ]);
    await expect(isConversationOpen(currentDb().db, { chatId: CHAT_ID })).resolves.toBe(true);
    await expect(
      openConversationParticipantIds(currentDb().db, { chatId: CHAT_ID }),
    ).resolves.toStrictEqual([ALICE.id]);
  });

  it("falls back to first_name when the speaker has no username", async () => {
    expect.hasAssertions();
    await freshDb();

    const result = await handle(
      textUpdate({
        from: LENA,
        messageId: 80,
        text: "бот",
        updateId: 1,
      }),
    );

    expect(result).toStrictEqual({ kind: "reply", text: "че", type: "conversation" });
    await expect(
      openConversationMemberTurns(currentDb().db, { chatId: CHAT_ID }),
    ).resolves.toStrictEqual(["[Лена] бот"]);
    expect(lastCapturedModelBodyJson()).toContain("в чате разговаривают: Лена (Лена Иванова)");
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
      liveLabeled("alice", "бот"),
      liveLabeled("alice", "как дела"),
    ]);
    await expect(
      openConversationMemberTurns(currentDb().db, { chatId: CHAT_ID }),
    ).resolves.toStrictEqual(["[alice] бот", "[alice] как дела"]);
  });

  it("ages live turns against the triggering Telegram date", async () => {
    expect.hasAssertions();
    await freshDb();

    const firstDate = 1_700_000_000;
    await handle(
      textUpdate({
        date: firstDate,
        from: ALICE,
        messageId: 72,
        text: "бот",
        updateId: 10,
      }),
    );
    const result = await handle(
      textUpdate({
        date: firstDate + TWO_HOURS_SECONDS,
        from: ALICE,
        messageId: 73,
        text: "как дела",
        updateId: 11,
      }),
    );

    expect(result).toStrictEqual({ kind: "reply", text: "че", type: "conversation" });
    expect(liveLabeledTurnTextsFromLastModelBody()).toStrictEqual([
      liveLabeled("alice", "бот", "2 ч назад"),
      liveLabeled("alice", "как дела"),
    ]);
    expect(assistantTurnTextsFromLastModelBody()).toStrictEqual(["че"]);
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
    await expect(
      chatConversationMemberTurns(currentDb().db, { chatId: CHAT_ID }),
    ).resolves.toStrictEqual(["[alice] бот", "[alice] ещё слово"]);
  });

  it("seeds a Wake from ordinary Turns logged while the Conversation was closed", async () => {
    expect.hasAssertions();
    await freshDb();

    const beforeWake = await handle(
      textUpdate({
        from: BOB,
        messageId: 200,
        text: "он опять сломался",
        updateId: 200,
      }),
    );
    const woken = await handle(
      textUpdate({
        from: ALICE,
        messageId: 201,
        text: "бот",
        updateId: 201,
      }),
    );

    expect(beforeWake).toStrictEqual({ kind: "silence", type: "conversation" });
    expect(woken).toStrictEqual({ kind: "reply", text: "че", type: "conversation" });
    await expect(isConversationOpen(currentDb().db, { chatId: CHAT_ID })).resolves.toBe(true);
    expect(liveLabeledTurnTextsFromLastModelBody()).toStrictEqual([
      liveLabeled("bob", "он опять сломался"),
      liveLabeled("alice", "бот"),
    ]);
    expect(lastCapturedModelBodyJson()).toContain("в чате разговаривают: bob (Bob), alice (Alice)");
  });

  it("reopens the same Conversation on a later Wake with Turns from the closed gap", async () => {
    expect.hasAssertions();
    await freshDb();

    await handle(
      textUpdate({
        from: ALICE,
        messageId: 202,
        text: "бот",
        updateId: 202,
      }),
    );
    await handle(
      textUpdate({
        from: ALICE,
        messageId: 203,
        text: "довольно",
        updateId: 203,
      }),
    );
    const gap = await handle(
      textUpdate({
        from: BOB,
        messageId: 204,
        text: "как дела",
        updateId: 204,
      }),
    );
    const reopened = await handle(
      textUpdate({
        from: ALICE,
        messageId: 205,
        text: "бот",
        updateId: 205,
      }),
    );

    expect(gap).toStrictEqual({ kind: "silence", type: "conversation" });
    expect(reopened).toStrictEqual({ kind: "reply", text: "че", type: "conversation" });
    await expect(
      openConversationParticipantIds(currentDb().db, { chatId: CHAT_ID }),
    ).resolves.toStrictEqual([ALICE.id]);
    expect(liveLabeledTurnTextsFromLastModelBody()).toStrictEqual([
      liveLabeled("alice", "бот"),
      liveLabeled("bob", "как дела"),
      liveLabeled("alice", "бот"),
    ]);
  });

  it("keeps 100 Turns while closed and drops the oldest on the 101st", async () => {
    expect.hasAssertions();
    await freshDb();

    const firstClosedId = 300;
    const overflowId = firstClosedId + CLOSED_TURN_WINDOW;
    const texts = numberedTexts("лог", CLOSED_TURN_WINDOW + SINGLE_COUNT);
    const results = await handleNumberedTexts(ALICE, texts, firstClosedId);

    expect(results).toStrictEqual(silenceResults(texts.length));
    await expect(chatConversationTurnCount(currentDb().db, { chatId: CHAT_ID })).resolves.toBe(
      CLOSED_TURN_WINDOW,
    );
    await expect(
      chatConversationMemberTurns(currentDb().db, { chatId: CHAT_ID }),
    ).resolves.toStrictEqual(texts.slice(SINGLE_COUNT).map((text) => `[alice] ${text}`));

    const woken = await handle(
      textUpdate({
        from: ALICE,
        messageId: overflowId + SINGLE_COUNT,
        text: "бот",
        updateId: overflowId + SINGLE_COUNT,
      }),
    );

    expect(woken).toStrictEqual({ kind: "reply", text: "че", type: "conversation" });
    expect(liveLabeledTurnTextsFromLastModelBody()).toStrictEqual([
      ...texts.slice(SINGLE_COUNT).map((text) => liveLabeled("alice", text)),
      liveLabeled("alice", "бот"),
    ]);
  });

  it("lets an open Conversation grow past 100 Turns and snaps to 100 on close", async () => {
    expect.hasAssertions();
    await freshDb();

    await handle(
      textUpdate({
        from: ALICE,
        messageId: 500,
        text: "бот",
        updateId: 500,
      }),
    );
    const bystanderStart = 501;
    const bystanderTexts = numberedTexts("фон", CLOSED_TURN_WINDOW);
    const bystanderResults = await handleNumberedTexts(BOB, bystanderTexts, bystanderStart);

    expect(bystanderResults).toStrictEqual(silenceResults(bystanderTexts.length));

    await expect(chatConversationTurnCount(currentDb().db, { chatId: CHAT_ID })).resolves.toBe(
      CLOSED_TURN_WINDOW + SINGLE_COUNT + SINGLE_COUNT,
    );

    const stopped = await handle(
      textUpdate({
        from: ALICE,
        messageId: 700,
        text: "довольно",
        updateId: 700,
      }),
    );

    expect(stopped).toStrictEqual({ kind: "closed", type: "conversation" });
    await expect(chatConversationTurnCount(currentDb().db, { chatId: CHAT_ID })).resolves.toBe(
      CLOSED_TURN_WINDOW,
    );
    await expect(
      chatConversationMemberTurns(currentDb().db, { chatId: CHAT_ID }),
    ).resolves.toStrictEqual(bystanderTexts.map((text) => `[bob] ${text}`));
  });

  it("does not log a Scoring reply as a Turn while the Conversation is closed", async () => {
    expect.hasAssertions();
    await freshDb();

    await handle(
      textUpdate({
        from: ALICE,
        messageId: 800,
        text: "привет",
        updateId: 800,
      }),
    );
    const scoring = await handle(
      textUpdate({
        from: ALICE,
        messageId: 801,
        replyTo: { from: BOB, messageId: 10 },
        text: "+",
        updateId: 801,
      }),
    );
    const woken = await handle(
      textUpdate({
        from: ALICE,
        messageId: 802,
        text: "бот",
        updateId: 802,
      }),
    );

    expect(scoring).toStrictEqual({
      kind: "accepted",
      text: "➕ (alice)",
      type: "scoring",
    });
    expect(woken).toStrictEqual({ kind: "reply", text: "че", type: "conversation" });
    expect(liveLabeledTurnTextsFromLastModelBody()).toStrictEqual([
      liveLabeled("alice", "привет"),
      liveLabeled("alice", "бот"),
    ]);
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
    ).resolves.toStrictEqual(["[alice] бот привет", "[bob] бот ку"]);
    await expect(
      openConversationParticipantIds(currentDb().db, { chatId: CHAT_ID }),
    ).resolves.toStrictEqual([ALICE.id, BOB.id]);
    expect(liveLabeledTurnTextsFromLastModelBody()).toStrictEqual([
      liveLabeled("alice", "бот привет"),
      liveLabeled("bob", "бот ку"),
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
    expect(liveLabeledTurnTextsFromLastModelBody()).toStrictEqual([liveLabeled("alice", "бот")]);
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
      liveLabeled("alice", "бот"),
      liveLabeled("bob", "он опять сломался"),
      liveLabeled("alice", "видишь"),
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
      liveLabeled("alice", "бот привет"),
      liveLabeled("bob", "бот ку"),
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
