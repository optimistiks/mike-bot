import { describe, expect, it } from "vitest";

import {
  convertV1LolType,
  convertV1Row,
  parseV1LolRow,
  v1DisplayName,
} from "./v1-row";

describe("convertV1LolType", () => {
  it("maps v1 lol types to v2 event types", () => {
    expect(convertV1LolType("plus")).toBe("karma.plus");
    expect(convertV1LolType("minus")).toBe("karma.minus");
    expect(convertV1LolType("lol")).toBe("humor.add");
  });
});

describe("v1DisplayName", () => {
  it("prefers @username when present", () => {
    expect(v1DisplayName({ id: 101, username: "alice" })).toBe("@alice");
  });

  it("falls back to User id when username is missing", () => {
    expect(v1DisplayName({ id: 101 })).toBe("User 101");
  });
});

describe("convertV1Row", () => {
  it("maps v1 fields to Event and Display identity rows", () => {
    const converted = convertV1Row({
      id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      createdAt: 1_690_000_000_123,
      lolType: "plus",
      fromUser: { id: 111, username: "alice" },
      toUser: { id: 222, username: "bob" },
      chatId: -1001234567890,
      toMessageId: 42,
    });

    expect(converted.event).toEqual({
      type: "karma.plus",
      chatId: -1001234567890,
      actorId: 111,
      subjectId: 222,
      messageId: 42,
      createdAt: new Date(1_690_000_000_123),
      reversible: false,
      reversesEventId: null,
      legacyId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    });

    expect(converted.displayIdentities).toEqual([
      {
        chatId: -1001234567890,
        userId: 111,
        displayName: "@alice",
      },
      {
        chatId: -1001234567890,
        userId: 222,
        displayName: "@bob",
      },
    ]);
  });
});

describe("parseV1LolRow", () => {
  it("validates DynamoDB document items", () => {
    expect(
      parseV1LolRow({
        id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        createdAt: 1_690_000_000_123,
        lolType: "lol",
        fromUser: { id: 1 },
        toUser: { id: 2, username: "bob" },
        chatId: -100,
        toMessageId: 9,
      }),
    ).toMatchObject({ lolType: "lol", toMessageId: 9 });
  });
});
