import { describe, expect, it } from "vitest";

import { textWithVisibleUrls } from "#src/telegram/text.js";

describe("text with visible urls", () => {
  it("appends a text_link url after the display text", () => {
    expect.hasAssertions();
    expect(
      textWithVisibleUrls("бот глянь статью", [
        { length: 6, offset: 10, type: "text_link", url: "https://example.com/a" },
      ]),
    ).toBe("бот глянь статью https://example.com/a");
  });

  it("leaves a url that is already in the display text", () => {
    expect.hasAssertions();
    expect(
      textWithVisibleUrls("бот https://example.com/a", [
        { length: 21, offset: 4, type: "text_link", url: "https://example.com/a" },
      ]),
    ).toBe("бот https://example.com/a");
  });

  it("appends later text_links first so earlier offsets stay valid", () => {
    expect.hasAssertions();
    expect(
      textWithVisibleUrls("бот раз и два", [
        { length: 3, offset: 4, type: "text_link", url: "https://example.com/a" },
        { length: 3, offset: 10, type: "text_link", url: "https://example.com/b" },
      ]),
    ).toBe("бот раз https://example.com/a и два https://example.com/b");
  });
});
