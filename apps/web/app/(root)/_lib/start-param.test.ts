import { describe, expect, it } from "vitest";

import { chatIdFromStartParam } from "./start-param";

describe("chatIdFromStartParam", () => {
  it.each([
    ["chat_-100123", -100123],
    ["chat_42", 42],
    ["chat_nope", null],
    ["other_-100123", null],
    ["chat_9007199254740992", null],
    [undefined, null],
  ])("parses %j as %j", (value, expected) => {
    expect(chatIdFromStartParam(value)).toBe(expected);
  });
});
