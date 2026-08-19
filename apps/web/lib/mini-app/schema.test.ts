import { describe, expect, it } from "vitest";

import { chatsResponseSchema } from "./schema";

describe("chats API contract", () => {
  it("validates the chats response shape", () => {
    const response = chatsResponseSchema.parse({
      chats: [{ chatId: -100_456_789, label: "Чат -100456789" }],
    });

    expect(response.chats).toHaveLength(1);
  });
});
