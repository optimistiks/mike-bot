import { describe, expect, it } from "vitest";

import { parseUserIdFromAuthorization } from "./init-data";
import { chatsResponseSchema } from "./schema";

describe("chats API contract", () => {
  it("rejects requests without initData", () => {
    expect(parseUserIdFromAuthorization(null)).toBeNull();
  });

  it("validates the chats response shape", () => {
    const response = chatsResponseSchema.parse({
      chats: [{ chatId: -100_456_789, label: "Чат -100456789" }],
    });

    expect(response.chats).toHaveLength(1);
  });
});
