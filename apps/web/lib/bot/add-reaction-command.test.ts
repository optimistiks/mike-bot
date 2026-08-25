import { describe, expect, it } from "vitest";
import type { Message, MessageEntity } from "grammy/types";

import { parseAddReactionArgument } from "./add-reaction-command";
import { reactionDisplayLabel } from "./reaction-key";

function command(text: string, extra: MessageEntity[] = []): Message {
  const command = text.split(" ")[0] ?? "";

  return {
    message_id: 1,
    date: 0,
    chat: { id: -100_111_222, type: "supergroup", title: "Test" },
    from: { id: 101, is_bot: false, first_name: "Alice" },
    text,
    entities: [
      { type: "bot_command", offset: 0, length: command.length },
      ...extra,
    ],
  };
}

describe("parseAddReactionArgument", () => {
  it("reads a standard reaction emoji", () => {
    expect(parseAddReactionArgument(command("/addreaction 🤡"))).toEqual({
      ok: true,
      reactionKey: "emoji:🤡",
      label: null,
    });
  });

  it("reads the argument when the command is addressed to the bot", () => {
    expect(
      parseAddReactionArgument(command("/addreaction@mike_bot 🤡")),
    ).toEqual({ ok: true, reactionKey: "emoji:🤡", label: null });
  });

  it("reads a custom emoji and keeps Telegram's stand-in as its label", () => {
    const message = command("/addreaction 🎉", [
      { type: "custom_emoji", offset: 13, length: 2, custom_emoji_id: "9001" },
    ]);

    expect(parseAddReactionArgument(message)).toEqual({
      ok: true,
      reactionKey: "custom_emoji:9001",
      label: "🎉",
    });
  });

  it("normalizes an emoji a person typed with its variation selector", () => {
    // A person sends ❤️ (U+2764 U+FE0F); Telegram names that reaction ❤ alone.
    // Storing the typed form would bind a reaction that never fires.
    expect(parseAddReactionArgument(command("/addreaction ❤️"))).toEqual({
      ok: true,
      reactionKey: "emoji:❤",
      label: null,
    });
  });

  it.each([
    ["a family emoji held together by joiners", "👨‍👩‍👧"],
    ["an emoji carrying a skin-tone modifier", "👍🏽"],
  ])("treats %s as one reaction", (_case, emoji) => {
    // Telegram lists 👍 and 👨‍👩‍👧 with no modifier, so only the joined forms
    // that are themselves reactions survive; what matters here is that
    // segmentation does not see several graphemes and refuse outright.
    const result = parseAddReactionArgument(command(`/addreaction ${emoji}`));

    expect(result.ok ? "ok" : result.reason).not.toBe("unparseable");
  });

  it.each([
    ["no argument at all", "/addreaction"],
    ["only whitespace", "/addreaction   "],
  ])("refuses %s", (_case, text) => {
    expect(parseAddReactionArgument(command(text))).toEqual({
      ok: false,
      reason: "missing",
    });
  });

  it.each([
    ["two emoji", "/addreaction 🤡🤡"],
    ["a word", "/addreaction clown"],
  ])("refuses %s as unparseable", (_case, text) => {
    expect(parseAddReactionArgument(command(text))).toEqual({
      ok: false,
      reason: "unparseable",
    });
  });

  it("refuses an emoji Telegram does not allow as a reaction", () => {
    // The failure this prevents is silent: 🍕 would bind, and then no reaction
    // in the Chat could ever place the Mark.
    expect(parseAddReactionArgument(command("/addreaction 🍕"))).toEqual({
      ok: false,
      reason: "not_a_reaction",
    });
  });
});

describe("reactionDisplayLabel", () => {
  it("names a standard reaction by its own emoji", () => {
    expect(reactionDisplayLabel("emoji:🤡", null)).toBe("🤡");
  });

  it("names a custom reaction by its stand-in", () => {
    expect(reactionDisplayLabel("custom_emoji:9001", "🎉")).toBe("🎉");
  });

  it("falls back when a custom reaction had no stand-in", () => {
    expect(reactionDisplayLabel("custom_emoji:9001", null)).toBe("реакция");
  });
});
