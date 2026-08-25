import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  scoringReactionsResponseSchema,
  type ScoringReactionsResponse,
} from "@/lib/bot/scoring-reactions-schema";
import {
  addChatReaction,
  loadChatReactions,
} from "@/lib/bot/scoring-reactions";
import { addRegistration } from "@/lib/db/registrations";
import { getRuntimeDb, resetRuntimeDbForTests } from "@/lib/db/runtime";
import { mockChatAdmins } from "@/test/chat-admin";
import { signedTmaAuthorization, TEST_BOT_TOKEN } from "@/test/tma-init-data";

import { GET, PUT } from "./route";

const CHAT_ID = -100_111_222;
const ADMIN_ID = 101;
const MEMBER_ID = 102;

async function body(response: Response): Promise<ScoringReactionsResponse> {
  return scoringReactionsResponseSchema.parse(await response.json());
}

function params(chatId: number | string = CHAT_ID) {
  return { params: Promise.resolve({ chatId: String(chatId) }) };
}

function get(userId?: number, chatId: number | string = CHAT_ID) {
  return GET(
    new Request("http://localhost/api/chats/x/scoring-reactions", {
      headers:
        userId === undefined
          ? {}
          : { authorization: signedTmaAuthorization(userId) },
    }),
    params(chatId),
  );
}

function put(userId: number, bindings: unknown) {
  return PUT(
    new Request("http://localhost/api/chats/x/scoring-reactions", {
      method: "PUT",
      headers: { authorization: signedTmaAuthorization(userId) },
      body: JSON.stringify({ bindings }),
    }),
    params(),
  );
}

beforeEach(async () => {
  process.env.BOT_TOKEN = TEST_BOT_TOKEN;
  mockChatAdmins([ADMIN_ID]);

  const db = await getRuntimeDb();
  await addRegistration(db, CHAT_ID, ADMIN_ID);
  await addRegistration(db, CHAT_ID, MEMBER_ID);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await resetRuntimeDbForTests();
});

describe("GET", () => {
  it("reports the built-in defaults for a Chat that has never saved", async () => {
    const response = await get(ADMIN_ID);
    expect(response.status).toBe(200);

    const view = await body(response);

    expect(view.usingDefaults).toBe(true);
    expect(view.canEdit).toBe(true);
    expect(view.reactions).toContainEqual({
      reactionKey: "emoji:👍",
      markType: "karma.plus",
      label: null,
    });
    expect(view.reactions).toContainEqual({
      reactionKey: "emoji:🤣",
      markType: "humor.add",
      label: null,
    });
  });

  it("lets a registered non-administrator look, but not edit", async () => {
    const response = await get(MEMBER_ID);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ canEdit: false });
  });

  it("refuses an unauthenticated caller", async () => {
    expect((await get()).status).toBe(401);
  });

  it("refuses a Chat the caller has no Registration in", async () => {
    expect((await get(ADMIN_ID, -100_999_888)).status).toBe(403);
  });
});

describe("PUT", () => {
  it("saves a mapping and reports it back", async () => {
    // 🤡 has to be in the palette first: a save binds, it never creates.
    const db = await getRuntimeDb();
    await addChatReaction(
      db,
      { chatId: CHAT_ID, reactionKey: "emoji:🤡", label: null },
      new Date(),
    );

    const response = await put(ADMIN_ID, { "humor.add": ["emoji:🤡"] });
    expect(response.status).toBe(200);

    const view = await body(response);

    expect(view.usingDefaults).toBe(false);
    expect(view.canEdit).toBe(true);
    expect(view.reactions).toContainEqual({
      reactionKey: "emoji:🤡",
      markType: "humor.add",
      label: null,
    });
    // The defaults are materialised and unbound, not left implicit.
    expect(view.reactions).toContainEqual({
      reactionKey: "emoji:👍",
      markType: null,
      label: null,
    });
  });

  it("refuses a registered Member who does not administer the Chat", async () => {
    expect((await put(MEMBER_ID, { "humor.add": ["emoji:🤡"] })).status).toBe(
      403,
    );
  });

  it("refuses one reaction assigned to two Marks", async () => {
    const response = await put(ADMIN_ID, {
      "humor.add": ["emoji:🤣"],
      "karma.plus": ["emoji:🤣"],
    });

    expect(response.status).toBe(400);
  });

  it.each([
    ["an unknown Mark type", { "karma.sideways": ["emoji:🤡"] }],
    ["a paid reaction key", { "humor.add": ["paid"] }],
    ["a malformed reaction key", { "humor.add": ["🤡"] }],
  ])("refuses %s", async (_case, bindings) => {
    expect((await put(ADMIN_ID, bindings)).status).toBe(400);
  });

  it("refuses a reaction the Chat's palette has never held", async () => {
    // Binding does not grow the palette; only the Add reaction command does.
    // Without this, a save could create and bind 🍕 — a reaction Telegram will
    // never deliver — and the Mark would silently never fire.
    const response = await put(ADMIN_ID, { "humor.add": ["emoji:🍕"] });

    expect(response.status).toBe(400);

    const db = await getRuntimeDb();
    expect(await loadChatReactions(db, CHAT_ID)).toEqual([]);
  });

  it("cannot outgrow the palette cap, however many keys are sent", async () => {
    const response = await put(ADMIN_ID, {
      "humor.add": Array.from(
        { length: 500 },
        (_unused, index) => `custom_emoji:${String(index)}`,
      ),
    });

    expect(response.status).toBe(400);

    const db = await getRuntimeDb();
    expect(await loadChatReactions(db, CHAT_ID)).toEqual([]);
  });

  it("keeps an all-empty save empty across a reload", async () => {
    expect((await put(ADMIN_ID, { "humor.add": ["emoji:🤣"] })).status).toBe(
      200,
    );
    expect((await put(ADMIN_ID, {})).status).toBe(200);

    const reloaded = await body(await get(ADMIN_ID));

    // The regression this whole design turns on: unassigning everything must
    // not read as "never configured" and silently restore 👍/👎/🤣.
    expect(reloaded.usingDefaults).toBe(false);
    expect(reloaded.reactions.every((row) => row.markType === null)).toBe(true);
  });

  it("moves a reaction between Marks rather than holding both", async () => {
    await put(ADMIN_ID, { "humor.add": ["emoji:🤣"] });
    const response = await put(ADMIN_ID, { "karma.plus": ["emoji:🤣"] });

    const rows = (await body(response)).reactions.filter(
      (row) => row.reactionKey === "emoji:🤣",
    );

    expect(rows).toEqual([
      { reactionKey: "emoji:🤣", markType: "karma.plus", label: null },
    ]);
  });

  it("leaves an /addreaction reaction in the palette when a save ignores it", async () => {
    const db = await getRuntimeDb();
    await addChatReaction(
      db,
      { chatId: CHAT_ID, reactionKey: "custom_emoji:9001", label: "🎉" },
      new Date(),
    );

    const response = await put(ADMIN_ID, { "karma.plus": ["emoji:👍"] });

    expect((await body(response)).reactions).toContainEqual({
      reactionKey: "custom_emoji:9001",
      markType: null,
      label: "🎉",
    });
  });
});
