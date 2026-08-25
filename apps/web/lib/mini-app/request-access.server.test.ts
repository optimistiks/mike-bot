import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { addRegistration } from "@/lib/db/registrations";
import { getRuntimeDb, resetRuntimeDbForTests } from "@/lib/db/runtime";
import { mockChatAdmins, mockChatAdminsUnavailable } from "@/test/chat-admin";
import { signedTmaAuthorization, TEST_BOT_TOKEN } from "@/test/tma-init-data";

import {
  requireChatAccess,
  requireChatAdminAccess,
} from "./request-access.server";

const CHAT_ID = -100_111_222;
const ADMIN_ID = 101;
const MEMBER_ID = 102;
const STRANGER_ID = 103;

function request(userId?: number): Request {
  return new Request(
    "http://localhost/api/chats/-100111222/scoring-reactions",
    {
      headers:
        userId === undefined
          ? {}
          : { authorization: signedTmaAuthorization(userId) },
    },
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

describe("requireChatAdminAccess", () => {
  it("lets a registered administrator through", async () => {
    await expect(
      requireChatAdminAccess(request(ADMIN_ID), CHAT_ID),
    ).resolves.toBeNull();
  });

  it("refuses a registered Member who does not administer the Chat", async () => {
    // The distinction the whole settings route rests on: viewing is
    // Registration, changing is administration.
    const refusal = await requireChatAdminAccess(request(MEMBER_ID), CHAT_ID);

    expect(refusal?.status).toBe(403);
  });

  it("refuses an administrator of some other Chat", async () => {
    const refusal = await requireChatAdminAccess(
      request(ADMIN_ID),
      -100_999_888,
    );

    expect(refusal?.status).toBe(403);
  });

  it("refuses a caller with no Registration at all", async () => {
    const refusal = await requireChatAdminAccess(request(STRANGER_ID), CHAT_ID);

    expect(refusal?.status).toBe(403);
  });

  it("refuses an unauthenticated caller before looking at the Chat", async () => {
    const refusal = await requireChatAdminAccess(request(), CHAT_ID);

    expect(refusal?.status).toBe(401);
  });

  it("refuses when Telegram will not say who administers the Chat", async () => {
    mockChatAdminsUnavailable();

    // Refusing is the safe direction: an unreachable Telegram must not open
    // the gate.
    const refusal = await requireChatAdminAccess(request(ADMIN_ID), CHAT_ID);

    expect(refusal?.status).toBe(403);
  });

  it("refuses an unparseable Chat id", async () => {
    const refusal = await requireChatAdminAccess(request(ADMIN_ID), "nonsense");

    expect(refusal?.status).toBe(400);
  });
});

describe("requireChatAccess", () => {
  it("still lets a registered non-administrator view the Chat", async () => {
    await expect(
      requireChatAccess(request(MEMBER_ID), CHAT_ID),
    ).resolves.toBeNull();
  });
});
