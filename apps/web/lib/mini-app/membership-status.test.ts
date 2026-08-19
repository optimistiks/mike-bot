import { describe, expect, it } from "vitest";

import {
  isActiveChatMemberStatus,
  isBotPresentStatus,
} from "./membership-status";

describe("membership status helpers", () => {
  it("treats member-like statuses as active", () => {
    expect(isActiveChatMemberStatus("member")).toBe(true);
    expect(isActiveChatMemberStatus("administrator")).toBe(true);
    expect(isActiveChatMemberStatus("creator")).toBe(true);
    expect(isActiveChatMemberStatus("restricted")).toBe(true);
  });

  it("treats left and kicked as inactive", () => {
    expect(isActiveChatMemberStatus("left")).toBe(false);
    expect(isActiveChatMemberStatus("kicked")).toBe(false);
  });

  it("detects when the bot is present in a chat", () => {
    expect(isBotPresentStatus("administrator")).toBe(true);
    expect(isBotPresentStatus("member")).toBe(true);
    expect(isBotPresentStatus("left")).toBe(false);
    expect(isBotPresentStatus("kicked")).toBe(false);
  });
});
