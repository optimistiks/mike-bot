import type { Update } from "grammy/types";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PgliteDatabase } from "#src/db/pglite.js";
import type { HandlerResult } from "#src/outcomes.js";

import { closePgliteDb, createPgliteDb, resetPgliteDb } from "#src/db/pglite.js";
import { handleUpdate } from "#src/handle-update.js";

import { ALICE, BOB, BOT_USER, CAROL, LENA, statsUpdate, textUpdate } from "./helpers.js";
import {
  assistantTurnTextsFromLastModelBody,
  capturedModelBodies,
  createQuietGate,
  enqueueModelTexts,
  failNextModelRequest,
  holdNextModelResponse,
  lastCapturedModelBodyJson,
  liveLabeledTurnTextsFromLastModelBody,
  modelServer,
  resetCapturedModelBodies,
  waitUntilModelCallCount,
} from "./msw.js";

const STANDINGS_UPDATE_ID = 8;
const EMPTY_STATS_UPDATE_ID = 1;
const MOSCOW_2024_MID = 1_718_442_000;
const MOSCOW_2025_MID = 1_749_978_000;
const MOSCOW_2026_MID = 1_781_514_000;
const MOSCOW_2025_START = 1_735_678_800;
const MOSCOW_BEFORE_2025 = 1_735_678_799;
const CLOSED_TURN_WINDOW = 100;
const ZERO_AGE = "0 сек. назад";
const TWO_HOURS_SECONDS = 7200;
const QUOTE_CAP = 200;
const QUOTE_OVER_CAP = 201;

function liveLabeled(handle: string, text: string, age = ZERO_AGE): string {
  return `[${handle}][${age}] ${text}`;
}

function liveReplyLabeled(
  speaker: string,
  target: string,
  quote: string | null,
  text: string,
  age = ZERO_AGE,
): string {
  if (quote === null) {
    return `[${speaker} → ${target}][${age}] ${text}`;
  }
  return `[${speaker} → ${target}][${age}][на "${quote}"] ${text}`;
}

function numberedTexts(prefix: string, count: number): string[] {
  const texts: string[] = [];
  for (let index = 1; index <= count; index++) {
    texts.push(`${prefix} ${String(index)}`);
  }
  return texts;
}

function plusOnlySeasonHtml(year: string, receiver: string, giver: string): string {
  const names = [receiver, giver].toSorted((left, right) => left.localeCompare(right));
  const humorRows = names
    .map((name) => `<tr><td><b>${name} 👑</b></td><td align="center"><b>0</b></td></tr>`)
    .join("");
  const zeroGivenRows = names
    .map((name) => `<tr><td>${name}</td><td align="center">0</td></tr>`)
    .join("");
  return [
    `<h1>Сезон ${year}</h1>`,
    "<h2>Уважаемые люди</h2>",
    "<table bordered striped compact>",
    `<tr><td><b>${receiver} 👑</b></td><td align="center"><b>1</b></td></tr>`,
    `<tr><td>${giver} 🐔</td><td align="center">0</td></tr>`,
    "</table><hr/>",
    "<h2>Юмористы</h2>",
    "<table bordered striped compact>",
    humorRows,
    "</table><hr/>",
    "<h2>Поставили ➕</h2>",
    "<table bordered striped compact>",
    `<tr><td>${giver}</td><td align="center">1</td></tr>`,
    `<tr><td>${receiver}</td><td align="center">0</td></tr>`,
    "</table><hr/>",
    "<h2>Поставили ➖</h2>",
    "<table bordered striped compact>",
    zeroGivenRows,
    "</table><hr/>",
    "<h2>Поставили лол</h2>",
    "<table bordered striped compact>",
    zeroGivenRows,
    "</table>",
  ].join("");
}

function silenceResults(count: number): HandlerResult[] {
  return Array.from({ length: count }, () => ({
    kind: "silence" as const,
    type: "conversation" as const,
  }));
}

describe("telegram update handling", () => {
  // eslint-disable-next-line init-declarations -- assigned in beforeAll
  let database: PgliteDatabase | undefined;

  function currentDb(): PgliteDatabase {
    if (database === undefined) {
      throw new Error("database is unset");
    }
    return database;
  }

  beforeAll(async () => {
    modelServer.listen({ onUnhandledRequest: "error" });
    database = await createPgliteDb();
  });

  beforeEach(async () => {
    await resetPgliteDb(currentDb());
  });

  function handle(update: Update, botUserId?: number): Promise<HandlerResult> {
    return handleUpdate(update, {
      botUserId,
      db: currentDb().db,
      waitForQuiet: () => Promise.resolve(),
    });
  }

  function handleAfterQuiet(
    update: Update,
    waitForQuiet: () => Promise<void>,
  ): Promise<HandlerResult> {
    return handleUpdate(update, {
      db: currentDb().db,
      waitForQuiet,
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
    const following = await handleNumberedTexts(from, rest, firstId + 1);
    return [result, ...following];
  }

  afterEach(() => {
    resetCapturedModelBodies();
    modelServer.resetHandlers();
  });

  afterAll(async () => {
    modelServer.close();
    if (database !== undefined) {
      await closePgliteDb(database);
    }
  });

  it("accepts a + Scoring reply, stores the Mark, and answers with ➕ (name)", async () => {
    expect.hasAssertions();
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
  });

  it("accepts лол as a Humor Mark regardless of case", async () => {
    expect.hasAssertions();
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
  });

  it("ignores self-scoring, bot Subjects, and a missing reply", async () => {
    expect.hasAssertions();
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
  });

  it("ignores a second + on the same Message and leaves the token", async () => {
    expect.hasAssertions();
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

  it("posts rich Standings HTML for a Chat with Marks", async () => {
    expect.hasAssertions();
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
        "<h1>Сезон 2023</h1>",
        "<h2>Уважаемые люди</h2>",
        "<table bordered striped compact>",
        '<tr><td><b>alice 👑</b></td><td align="center"><b>2</b></td></tr>',
        '<tr><td>bob</td><td align="center">1</td></tr>',
        '<tr><td>carol 🐔</td><td align="center">-1</td></tr>',
        "</table><hr/>",
        "<h2>Юмористы</h2>",
        "<table bordered striped compact>",
        '<tr><td><b>alice 👑</b></td><td align="center"><b>2</b></td></tr>',
        '<tr><td>carol</td><td align="center">1</td></tr>',
        '<tr><td>bob 🐔</td><td align="center">0</td></tr>',
        "</table><hr/>",
        "<h2>Поставили ➕</h2>",
        "<table bordered striped compact>",
        '<tr><td>alice</td><td align="center">1</td></tr>',
        '<tr><td>bob</td><td align="center">1</td></tr>',
        '<tr><td>carol</td><td align="center">1</td></tr>',
        "</table><hr/>",
        "<h2>Поставили ➖</h2>",
        "<table bordered striped compact>",
        '<tr><td>alice</td><td align="center">1</td></tr>',
        '<tr><td>bob</td><td align="center">0</td></tr>',
        '<tr><td>carol</td><td align="center">0</td></tr>',
        "</table><hr/>",
        "<h2>Поставили лол</h2>",
        "<table bordered striped compact>",
        '<tr><td>alice</td><td align="center">1</td></tr>',
        '<tr><td>bob</td><td align="center">1</td></tr>',
        '<tr><td>carol</td><td align="center">1</td></tr>',
        "</table>",
      ].join(""),
      type: "standings",
    });
  });

  it("leaves /stats untouched in a Chat with no Marks", async () => {
    expect.hasAssertions();
    const result = await handle(statsUpdate(EMPTY_STATS_UPDATE_ID, ALICE));

    expect(result).toStrictEqual({ kind: "empty", type: "standings" });
  });

  it("posts Standings for an explicit year and ignores extra tokens", async () => {
    expect.hasAssertions();
    await handle(
      textUpdate({
        date: MOSCOW_2024_MID,
        from: BOB,
        messageId: 20,
        replyTo: { date: MOSCOW_2024_MID, from: CAROL, messageId: 21 },
        text: "+",
        updateId: 1,
      }),
    );
    await handle(
      textUpdate({
        date: MOSCOW_2025_MID,
        from: ALICE,
        messageId: 22,
        replyTo: { date: MOSCOW_2025_MID, from: BOB, messageId: 23 },
        text: "+",
        updateId: 2,
      }),
    );

    const season2024 = await handle(
      statsUpdate(STANDINGS_UPDATE_ID, ALICE, { text: "/stats 2024 extra" }),
    );
    const season2025 = await handle(
      statsUpdate(STANDINGS_UPDATE_ID + 1, ALICE, {
        date: MOSCOW_2025_MID,
        text: "/stats@some_bot",
      }),
    );

    expect(season2024).toStrictEqual({
      kind: "posted",
      text: plusOnlySeasonHtml("2024", "carol", "bob"),
      type: "standings",
    });
    expect(season2025).toStrictEqual({
      kind: "posted",
      text: plusOnlySeasonHtml("2025", "bob", "alice"),
      type: "standings",
    });
  });

  it("leaves /stats untouched when the year is empty or not four digits", async () => {
    expect.hasAssertions();
    await handle(
      textUpdate({
        date: MOSCOW_2025_MID,
        from: ALICE,
        messageId: 22,
        replyTo: { date: MOSCOW_2025_MID, from: BOB, messageId: 23 },
        text: "+",
        updateId: 1,
      }),
    );

    const future = await handle(statsUpdate(2, ALICE, { text: "/stats 2099" }));
    const garbage = await handle(statsUpdate(3, ALICE, { text: "/stats foo" }));
    const short = await handle(statsUpdate(4, ALICE, { text: "/stats 25" }));
    const dotted = await handle(statsUpdate(5, ALICE, { text: "/stats 2025." }));

    expect(future).toStrictEqual({ kind: "empty", type: "standings" });
    expect(garbage).toStrictEqual({ kind: "empty", type: "standings" });
    expect(short).toStrictEqual({ kind: "empty", type: "standings" });
    expect(dotted).toStrictEqual({ kind: "empty", type: "standings" });
  });

  it("counts a Mark in the scored Message's year, not the vote year", async () => {
    expect.hasAssertions();
    await handle(
      textUpdate({
        date: MOSCOW_2026_MID,
        from: ALICE,
        messageId: 30,
        replyTo: { date: MOSCOW_2025_MID, from: BOB, messageId: 23 },
        text: "+",
        updateId: 1,
      }),
    );

    const season2025 = await handle(statsUpdate(2, ALICE, { text: "/stats 2025" }));
    const season2026 = await handle(statsUpdate(3, ALICE, { date: MOSCOW_2026_MID }));

    expect(season2025).toStrictEqual({
      kind: "posted",
      text: plusOnlySeasonHtml("2025", "bob", "alice"),
      type: "standings",
    });
    expect(season2026).toStrictEqual({ kind: "empty", type: "standings" });
  });

  it("assigns a Message on the Moscow New Year boundary to that year", async () => {
    expect.hasAssertions();
    await handle(
      textUpdate({
        date: MOSCOW_2025_START,
        from: ALICE,
        messageId: 40,
        replyTo: { date: MOSCOW_BEFORE_2025, from: BOB, messageId: 41 },
        text: "+",
        updateId: 1,
      }),
    );
    await handle(
      textUpdate({
        date: MOSCOW_2025_START,
        from: CAROL,
        messageId: 42,
        replyTo: { date: MOSCOW_2025_START, from: ALICE, messageId: 43 },
        text: "+",
        updateId: 2,
      }),
    );

    const season2024 = await handle(statsUpdate(3, ALICE, { text: "/stats 2024" }));
    const season2025 = await handle(statsUpdate(4, ALICE, { text: "/stats 2025" }));

    expect(season2024).toStrictEqual({
      kind: "posted",
      text: plusOnlySeasonHtml("2024", "bob", "alice"),
      type: "standings",
    });
    expect(season2025).toStrictEqual({
      kind: "posted",
      text: plusOnlySeasonHtml("2025", "alice", "carol"),
      type: "standings",
    });
  });

  it("wakes on бот and бот привет with labeled whole text", async () => {
    expect.hasAssertions();
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
  });

  it("falls back to first_name when the speaker has no username", async () => {
    expect.hasAssertions();
    const result = await handle(
      textUpdate({
        from: LENA,
        messageId: 80,
        text: "бот",
        updateId: 1,
      }),
    );

    expect(result).toStrictEqual({ kind: "reply", text: "че", type: "conversation" });
    expect(liveLabeledTurnTextsFromLastModelBody()).toStrictEqual([liveLabeled("Лена", "бот")]);
    expect(lastCapturedModelBodyJson()).toContain("в чате разговаривают: Лена (Лена Иванова)");
  });

  it("keeps later text without бот as a Turn with prior labeled history", async () => {
    expect.hasAssertions();
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
  });

  it("ages live turns against the triggering Telegram date", async () => {
    expect.hasAssertions();
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
    expect(assistantTurnTextsFromLastModelBody()).toStrictEqual([
      liveReplyLabeled("Ты", "alice", "бот", "че"),
    ]);
  });

  it("closes on довольно and stays silent afterwards", async () => {
    expect.hasAssertions();
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
  });

  it("seeds a Wake from ordinary Turns logged while the Conversation was closed", async () => {
    expect.hasAssertions();
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
    expect(liveLabeledTurnTextsFromLastModelBody()).toStrictEqual([
      liveLabeled("bob", "он опять сломался"),
      liveLabeled("alice", "бот"),
    ]);
    expect(lastCapturedModelBodyJson()).toContain("в чате разговаривают: bob (Bob), alice (Alice)");
  });

  it("reopens the same Conversation on a later Wake with Turns from the closed gap", async () => {
    expect.hasAssertions();
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
    expect(liveLabeledTurnTextsFromLastModelBody()).toStrictEqual([
      liveLabeled("alice", "бот"),
      liveLabeled("bob", "как дела"),
      liveLabeled("alice", "бот"),
    ]);
  });

  it("keeps 100 Turns while closed and drops the oldest on the 101st", async () => {
    expect.hasAssertions();
    const firstClosedId = 300;
    const overflowId = firstClosedId + CLOSED_TURN_WINDOW;
    const texts = numberedTexts("лог", CLOSED_TURN_WINDOW + 1);
    const results = await handleNumberedTexts(ALICE, texts, firstClosedId);

    expect(results).toStrictEqual(silenceResults(texts.length));

    const woken = await handle(
      textUpdate({
        from: ALICE,
        messageId: overflowId + 1,
        text: "бот",
        updateId: overflowId + 1,
      }),
    );

    expect(woken).toStrictEqual({ kind: "reply", text: "че", type: "conversation" });
    expect(liveLabeledTurnTextsFromLastModelBody()).toStrictEqual([
      ...texts.slice(1).map((text) => liveLabeled("alice", text)),
      liveLabeled("alice", "бот"),
    ]);
  });

  it("lets an open Conversation grow past 100 Turns and snaps to 100 on close", async () => {
    expect.hasAssertions();
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

    const stopped = await handle(
      textUpdate({
        from: ALICE,
        messageId: 700,
        text: "довольно",
        updateId: 700,
      }),
    );

    expect(stopped).toStrictEqual({ kind: "closed", type: "conversation" });

    const reopened = await handle(
      textUpdate({
        from: ALICE,
        messageId: 701,
        text: "бот",
        updateId: 701,
      }),
    );

    expect(reopened).toStrictEqual({ kind: "reply", text: "че", type: "conversation" });
    expect(liveLabeledTurnTextsFromLastModelBody()).toStrictEqual([
      ...bystanderTexts.map((text) => liveLabeled("bob", text)),
      liveLabeled("alice", "бот"),
    ]);
  });

  it("does not log a Scoring reply as a Turn while the Conversation is closed", async () => {
    expect.hasAssertions();
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
    expect(liveLabeledTurnTextsFromLastModelBody()).toStrictEqual([
      liveLabeled("alice", "бот привет"),
      liveLabeled("bob", "бот ку"),
    ]);
  });

  it("ignores a second delivery of the same update_id", async () => {
    expect.hasAssertions();
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
    expect(liveLabeledTurnTextsFromLastModelBody()).toStrictEqual([
      liveLabeled("alice", "бот"),
      liveLabeled("bob", "он опять сломался"),
      liveLabeled("alice", "видишь"),
    ]);
  });

  it("stays silent on empty model text and stores no assistant Turn", async () => {
    expect.hasAssertions();
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

    const next = await handle(
      textUpdate({
        from: ALICE,
        messageId: 98,
        text: "ещё",
        updateId: 3,
      }),
    );

    expect(next).toStrictEqual({ kind: "reply", text: "че", type: "conversation" });
    expect(assistantTurnTextsFromLastModelBody()).toStrictEqual([
      liveReplyLabeled("Ты", "alice", "бот", "че"),
    ]);
  });

  it("stays silent when the model request fails", async () => {
    expect.hasAssertions();
    await handle(
      textUpdate({
        from: ALICE,
        messageId: 120,
        text: "бот",
        updateId: 1,
      }),
    );
    failNextModelRequest();
    const result = await handle(
      textUpdate({
        from: ALICE,
        messageId: 121,
        text: "как дела",
        updateId: 2,
      }),
    );

    expect(result).toStrictEqual({ kind: "silence", type: "conversation" });
  });

  it("lets Bob complete while Alice's completion is in flight", async () => {
    expect.hasAssertions();
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
    const inFlightCount = capturedModelBodies.length + 1;
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

  it("answers a rapid burst with one completion that includes every turn", async () => {
    expect.hasAssertions();
    await handle(
      textUpdate({
        from: ALICE,
        messageId: 130,
        text: "бот",
        updateId: 1,
      }),
    );
    const gate = createQuietGate();
    const first = handleAfterQuiet(
      textUpdate({
        from: ALICE,
        messageId: 131,
        text: "раз",
        updateId: 2,
      }),
      gate.wait,
    );
    const second = handleAfterQuiet(
      textUpdate({
        from: ALICE,
        messageId: 132,
        text: "два",
        updateId: 3,
      }),
      gate.wait,
    );
    await gate.untilParked(2);
    gate.releaseAll();
    const burst = await Promise.all([first, second]);
    await handle(
      textUpdate({
        from: ALICE,
        messageId: 133,
        text: "три",
        updateId: 4,
      }),
    );

    expect(burst).toHaveLength(2);
    expect(burst).toStrictEqual(
      expect.arrayContaining([
        { kind: "reply", text: "че", type: "conversation" },
        { kind: "silence", type: "conversation" },
      ]),
    );
    expect(capturedModelBodies).toHaveLength(3);
    expect(liveLabeledTurnTextsFromLastModelBody()).toStrictEqual([
      liveLabeled("alice", "бот"),
      liveLabeled("alice", "раз"),
      liveLabeled("alice", "два"),
      liveLabeled("alice", "три"),
    ]);
    expect(assistantTurnTextsFromLastModelBody()).toStrictEqual([
      liveReplyLabeled("Ты", "alice", "бот", "че"),
      liveReplyLabeled("Ты", "alice", "два", "че"),
    ]);
  });

  it("skips a later turn while a completion lease is held", async () => {
    expect.hasAssertions();
    await handle(
      textUpdate({
        from: ALICE,
        messageId: 134,
        text: "бот",
        updateId: 1,
      }),
    );
    const release = holdNextModelResponse();
    const inFlightCount = capturedModelBodies.length + 1;
    const first = handle(
      textUpdate({
        from: ALICE,
        messageId: 135,
        text: "как дела",
        updateId: 2,
      }),
    );
    await waitUntilModelCallCount(inFlightCount);
    const skipped = await handle(
      textUpdate({
        from: ALICE,
        messageId: 136,
        text: "еще",
        updateId: 3,
      }),
    );
    release();
    const replied = await first;

    expect(skipped).toStrictEqual({ kind: "silence", type: "conversation" });
    expect(replied).toStrictEqual({ kind: "reply", text: "че", type: "conversation" });
    expect(capturedModelBodies).toHaveLength(2);
  });

  it("drops a pending completion after довольно", async () => {
    expect.hasAssertions();
    await handle(
      textUpdate({
        from: ALICE,
        messageId: 137,
        text: "бот",
        updateId: 1,
      }),
    );
    const gate = createQuietGate();
    const pending = handleAfterQuiet(
      textUpdate({
        from: ALICE,
        messageId: 138,
        text: "как дела",
        updateId: 2,
      }),
      gate.wait,
    );
    await gate.untilParked(1);
    const stopped = await handle(
      textUpdate({
        from: ALICE,
        messageId: 139,
        text: "довольно",
        updateId: 3,
      }),
    );
    gate.releaseAll();
    const skipped = await pending;

    expect(stopped).toStrictEqual({ kind: "closed", type: "conversation" });
    expect(skipped).toStrictEqual({ kind: "silence", type: "conversation" });
    expect(capturedModelBodies).toHaveLength(1);
  });

  it("retries a banned phrase and never posts the banned span", async () => {
    expect.hasAssertions();
    await handle(
      textUpdate({
        from: ALICE,
        messageId: 104,
        text: "бот",
        updateId: 1,
      }),
    );
    enqueueModelTexts(["ну я пошутил конечно", "че"]);
    const result = await handle(
      textUpdate({
        from: ALICE,
        messageId: 105,
        text: "шутка",
        updateId: 2,
      }),
    );

    expect(result).toStrictEqual({ kind: "reply", text: "че", type: "conversation" });
  });

  it("strips leading speaker labels from the model reply", async () => {
    expect.hasAssertions();
    await handle(
      textUpdate({
        from: ALICE,
        messageId: 106,
        text: "бот",
        updateId: 1,
      }),
    );
    enqueueModelTexts(["[alice][0 сек. назад] че"]);
    const result = await handle(
      textUpdate({
        from: ALICE,
        messageId: 107,
        text: "как дела",
        updateId: 2,
      }),
    );

    expect(result).toStrictEqual({ kind: "reply", text: "че", type: "conversation" });
  });

  it("labels a member telegram reply with addressee and quote", async () => {
    expect.hasAssertions();
    await handle(
      textUpdate({
        from: ALICE,
        messageId: 108,
        replyTo: { from: BOB, messageId: 10, text: "а когда дедлайн" },
        text: "бот",
        updateId: 1,
      }),
    );

    expect(liveLabeledTurnTextsFromLastModelBody()).toStrictEqual([
      liveReplyLabeled("alice", "bob", "а когда дедлайн", "бот"),
    ]);
  });

  it("keeps the reply arrow and drops the quote when the parent has no text", async () => {
    expect.hasAssertions();
    await handle(
      textUpdate({
        from: ALICE,
        messageId: 109,
        replyTo: { from: BOB, messageId: 10, text: null },
        text: "бот",
        updateId: 1,
      }),
    );

    expect(liveLabeledTurnTextsFromLastModelBody()).toStrictEqual([
      liveReplyLabeled("alice", "bob", null, "бот"),
    ]);
  });

  it("uses Ты when a member replies to this bot", async () => {
    expect.hasAssertions();
    await handle(
      textUpdate({
        from: ALICE,
        messageId: 110,
        replyTo: { from: BOT_USER, messageId: 11, text: "че" },
        text: "бот",
        updateId: 1,
      }),
      BOT_USER.id,
    );

    expect(liveLabeledTurnTextsFromLastModelBody()).toStrictEqual([
      liveReplyLabeled("alice", "Ты", "че", "бот"),
    ]);
  });

  it("uses the other bot handle when a member replies to a different bot", async () => {
    expect.hasAssertions();
    await handle(
      textUpdate({
        from: ALICE,
        messageId: 111,
        replyTo: { from: BOT_USER, messageId: 11, text: "че" },
        text: "бот",
        updateId: 1,
      }),
    );

    expect(liveLabeledTurnTextsFromLastModelBody()).toStrictEqual([
      liveReplyLabeled("alice", "some_bot", "че", "бот"),
    ]);
  });

  it("sanitizes reply quotes by stripping brackets and quotes and collapsing space", async () => {
    expect.hasAssertions();
    await handle(
      textUpdate({
        from: ALICE,
        messageId: 112,
        replyTo: { from: BOB, messageId: 10, text: 'он сказал "привет"\n[alice]' },
        text: "бот",
        updateId: 1,
      }),
    );

    expect(liveLabeledTurnTextsFromLastModelBody()).toStrictEqual([
      liveReplyLabeled("alice", "bob", "он сказал привет alice", "бот"),
    ]);
  });

  it("caps a long reply quote at 200 characters with ascii ellipsis", async () => {
    expect.hasAssertions();
    const longParent = "я".repeat(QUOTE_OVER_CAP);
    await handle(
      textUpdate({
        from: ALICE,
        messageId: 113,
        replyTo: { from: BOB, messageId: 10, text: longParent },
        text: "бот",
        updateId: 1,
      }),
    );

    expect(liveLabeledTurnTextsFromLastModelBody()).toStrictEqual([
      liveReplyLabeled("alice", "bob", `${"я".repeat(QUOTE_CAP)}...`, "бот"),
    ]);
  });
});
