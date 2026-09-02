import { afterEach, expect, it } from "vitest";

import { gatewayConversationModel } from "../src/conversation/model";
import { isConversationOpen, markExists, openConversationMemberTurns } from "../src/db/queries";
import { closePgliteDb, createPgliteDb, type PgliteDatabase } from "../src/db/pglite";
import { handleUpdate } from "../src/handle-update";
import { ALICE, BOB, BOT_USER, CAROL, CHAT_ID, statsUpdate, textUpdate } from "./helpers";
import { userTurnTextsFromModelBodies } from "./msw";

let database: PgliteDatabase;

async function handle(update: Parameters<typeof handleUpdate>[0]) {
  return handleUpdate(update, {
    db: database.db,
    model: gatewayConversationModel,
  });
}

afterEach(async () => {
  if (database) {
    await closePgliteDb(database);
  }
});

async function freshDb() {
  database = await createPgliteDb();
}

it("accepts a + Scoring reply, stores the Mark, and answers with ➕ (name)", async () => {
  await freshDb();

  const result = await handle(
    textUpdate({
      updateId: 1,
      messageId: 50,
      from: ALICE,
      text: " + ",
      replyTo: { messageId: 10, from: BOB },
    }),
  );

  expect(result).toEqual({
    type: "scoring",
    kind: "accepted",
    text: "➕ (alice)",
  });
  expect(
    await markExists(database.db, {
      chatId: CHAT_ID,
      actorId: ALICE.id,
      messageId: 10,
      type: "karma.plus",
    }),
  ).toBe(true);
});

it("accepts лол as a Humor Mark regardless of case", async () => {
  await freshDb();

  const result = await handle(
    textUpdate({
      updateId: 1,
      messageId: 51,
      from: ALICE,
      text: "ЛОЛ",
      replyTo: { messageId: 10, from: BOB },
    }),
  );

  expect(result).toEqual({
    type: "scoring",
    kind: "accepted",
    text: "лол (alice)",
  });
  expect(
    await markExists(database.db, {
      chatId: CHAT_ID,
      actorId: ALICE.id,
      messageId: 10,
      type: "humor.add",
    }),
  ).toBe(true);
});

it("ignores self-scoring, bot Subjects, and a missing reply", async () => {
  await freshDb();

  const self = await handle(
    textUpdate({
      updateId: 1,
      messageId: 52,
      from: ALICE,
      text: "+",
      replyTo: { messageId: 10, from: ALICE },
    }),
  );
  const botSubject = await handle(
    textUpdate({
      updateId: 2,
      messageId: 53,
      from: ALICE,
      text: "+",
      replyTo: { messageId: 11, from: BOT_USER },
    }),
  );
  const missing = await handle(
    textUpdate({
      updateId: 3,
      messageId: 54,
      from: ALICE,
      text: "+",
    }),
  );

  expect(self).toEqual({ type: "scoring", kind: "ignored" });
  expect(botSubject).toEqual({ type: "scoring", kind: "ignored" });
  expect(missing).toEqual({ type: "scoring", kind: "ignored" });
  expect(
    await markExists(database.db, {
      chatId: CHAT_ID,
      actorId: ALICE.id,
      messageId: 10,
      type: "karma.plus",
    }),
  ).toBe(false);
  expect(
    await markExists(database.db, {
      chatId: CHAT_ID,
      actorId: ALICE.id,
      messageId: 11,
      type: "karma.plus",
    }),
  ).toBe(false);
});

it("ignores a second + on the same Message and leaves the token", async () => {
  await freshDb();

  await handle(
    textUpdate({
      updateId: 1,
      messageId: 55,
      from: ALICE,
      text: "+",
      replyTo: { messageId: 10, from: BOB },
    }),
  );
  const result = await handle(
    textUpdate({
      updateId: 2,
      messageId: 56,
      from: ALICE,
      text: "+",
      replyTo: { messageId: 10, from: BOB },
    }),
  );

  expect(result).toEqual({ type: "scoring", kind: "ignored" });
});

it("posts v1 Standings Markdown for a Chat with Marks", async () => {
  await freshDb();

  await handle(
    textUpdate({
      updateId: 1,
      messageId: 61,
      from: BOB,
      text: "+",
      replyTo: { messageId: 10, from: ALICE },
    }),
  );
  await handle(
    textUpdate({
      updateId: 2,
      messageId: 62,
      from: CAROL,
      text: "+",
      replyTo: { messageId: 11, from: ALICE },
    }),
  );
  await handle(
    textUpdate({
      updateId: 3,
      messageId: 63,
      from: ALICE,
      text: "+",
      replyTo: { messageId: 12, from: BOB },
    }),
  );
  await handle(
    textUpdate({
      updateId: 4,
      messageId: 64,
      from: ALICE,
      text: "-",
      replyTo: { messageId: 13, from: CAROL },
    }),
  );
  await handle(
    textUpdate({
      updateId: 5,
      messageId: 65,
      from: BOB,
      text: "лол",
      replyTo: { messageId: 10, from: ALICE },
    }),
  );
  await handle(
    textUpdate({
      updateId: 6,
      messageId: 66,
      from: CAROL,
      text: "лол",
      replyTo: { messageId: 11, from: ALICE },
    }),
  );
  await handle(
    textUpdate({
      updateId: 7,
      messageId: 67,
      from: ALICE,
      text: "лол",
      replyTo: { messageId: 13, from: CAROL },
    }),
  );

  const result = await handle(statsUpdate(8, ALICE));

  expect(result).toEqual({
    type: "standings",
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
  });
});

it("leaves /stats untouched in a Chat with no Marks", async () => {
  await freshDb();

  const result = await handle(statsUpdate(1, ALICE));

  expect(result).toEqual({ type: "standings", kind: "empty" });
});

it("opens a Conversation on бот and sends that text as-is to the model", async () => {
  await freshDb();

  const result = await handle(
    textUpdate({
      updateId: 1,
      messageId: 70,
      from: ALICE,
      text: "бот",
    }),
  );

  expect(result).toEqual({ type: "conversation", kind: "reply", text: "че" });
  expect(userTurnTextsFromModelBodies()).toEqual(["бот"]);
  expect(
    await isConversationOpen(database.db, {
      chatId: CHAT_ID,
      memberId: ALICE.id,
    }),
  ).toBe(true);
});

it("keeps later text without бот as a Turn with prior history", async () => {
  await freshDb();

  await handle(
    textUpdate({
      updateId: 1,
      messageId: 71,
      from: ALICE,
      text: "бот",
    }),
  );
  const result = await handle(
    textUpdate({
      updateId: 2,
      messageId: 72,
      from: ALICE,
      text: "как дела",
    }),
  );

  expect(result).toEqual({ type: "conversation", kind: "reply", text: "че" });
  expect(userTurnTextsFromModelBodies()).toEqual(["бот", "бот", "как дела"]);
  expect(
    await openConversationMemberTurns(database.db, {
      chatId: CHAT_ID,
      memberId: ALICE.id,
    }),
  ).toEqual(["бот", "как дела"]);
});

it("closes on довольно and stays silent afterwards", async () => {
  await freshDb();

  await handle(
    textUpdate({
      updateId: 1,
      messageId: 73,
      from: ALICE,
      text: "бот",
    }),
  );
  const stopped = await handle(
    textUpdate({
      updateId: 2,
      messageId: 74,
      from: ALICE,
      text: "довольно",
    }),
  );
  const later = await handle(
    textUpdate({
      updateId: 3,
      messageId: 75,
      from: ALICE,
      text: "ещё слово",
    }),
  );

  expect(stopped).toEqual({ type: "conversation", kind: "silence" });
  expect(later).toEqual({ type: "conversation", kind: "silence" });
  expect(
    await isConversationOpen(database.db, {
      chatId: CHAT_ID,
      memberId: ALICE.id,
    }),
  ).toBe(false);
});

it("isolates two Members in one Chat and still accepts Scoring during a Conversation", async () => {
  await freshDb();

  await handle(
    textUpdate({
      updateId: 1,
      messageId: 80,
      from: ALICE,
      text: "бот привет",
    }),
  );
  await handle(
    textUpdate({
      updateId: 2,
      messageId: 81,
      from: BOB,
      text: "бот ку",
    }),
  );
  const scoring = await handle(
    textUpdate({
      updateId: 3,
      messageId: 82,
      from: ALICE,
      text: "+",
      replyTo: { messageId: 12, from: BOB },
    }),
  );

  expect(scoring).toEqual({
    type: "scoring",
    kind: "accepted",
    text: "➕ (alice)",
  });
  expect(
    await openConversationMemberTurns(database.db, {
      chatId: CHAT_ID,
      memberId: ALICE.id,
    }),
  ).toEqual(["бот привет"]);
  expect(
    await openConversationMemberTurns(database.db, {
      chatId: CHAT_ID,
      memberId: BOB.id,
    }),
  ).toEqual(["бот ку"]);
  expect(userTurnTextsFromModelBodies()).toEqual(["бот привет", "бот ку"]);
});
