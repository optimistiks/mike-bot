import { describe, expect, it, vi } from "vitest";

import { parseV1Items } from "./scan-v1";

describe("parseV1Items", () => {
  it("logs and skips malformed items while retaining valid rows", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const valid = {
      id: "11111111-1111-4111-8111-111111111111",
      createdAt: 1_690_000_000_123,
      lolType: "plus",
      fromUser: { id: 1 },
      toUser: { id: 2 },
      chatId: -100,
      toMessageId: 9,
    };

    try {
      expect(parseV1Items([valid, { broken: true }, null])).toEqual({
        rows: [valid],
        skipped: 2,
      });
      expect(warn).toHaveBeenCalledTimes(2);
    } finally {
      warn.mockRestore();
    }
  });
});
