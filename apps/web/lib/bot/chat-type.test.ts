import { describe, expect, it } from "vitest";

import { isScorableChatType } from "./chat-type";

describe("isScorableChatType", () => {
  it.each(["group", "supergroup"] as const)("scores in a %s", (type) => {
    expect(isScorableChatType(type)).toBe(true);
  });

  it.each(["private", "channel"] as const)("ignores a %s", (type) => {
    expect(isScorableChatType(type)).toBe(false);
  });
});
