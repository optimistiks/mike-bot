import { describe, expect, it } from "vitest";

import {
  assertWebhookRegistered,
  TELEGRAM_WEBHOOK_ALLOWED_UPDATES,
} from "./webhook-setup";

const webhookUrl = "https://mike-bot.vercel.app/api/telegram";

describe("TELEGRAM_WEBHOOK_ALLOWED_UPDATES", () => {
  it("includes message, message_reaction, and chat_member only", () => {
    expect(TELEGRAM_WEBHOOK_ALLOWED_UPDATES).toEqual([
      "message",
      "message_reaction",
      "chat_member",
    ]);
  });
});

describe("assertWebhookRegistered", () => {
  it("passes when url and allowed_updates match", () => {
    expect(() => {
      assertWebhookRegistered(
        {
          url: webhookUrl,
          allowed_updates: [...TELEGRAM_WEBHOOK_ALLOWED_UPDATES],
        },
        { url: webhookUrl, allowedUpdates: TELEGRAM_WEBHOOK_ALLOWED_UPDATES },
      );
    }).not.toThrow();
  });

  it("throws when url differs", () => {
    expect(() => {
      assertWebhookRegistered(
        {
          url: "https://other.example/api/telegram",
          allowed_updates: [...TELEGRAM_WEBHOOK_ALLOWED_UPDATES],
        },
        { url: webhookUrl, allowedUpdates: TELEGRAM_WEBHOOK_ALLOWED_UPDATES },
      );
    }).toThrow(/Webhook URL mismatch/);
  });

  it("throws when message_reaction is missing", () => {
    expect(() => {
      assertWebhookRegistered(
        {
          url: webhookUrl,
          allowed_updates: ["message", "chat_member"],
        },
        { url: webhookUrl, allowedUpdates: TELEGRAM_WEBHOOK_ALLOWED_UPDATES },
      );
    }).toThrow(/message_reaction/);
  });

  it("throws when my_chat_member is registered", () => {
    expect(() => {
      assertWebhookRegistered(
        {
          url: webhookUrl,
          allowed_updates: [
            "message",
            "message_reaction",
            "chat_member",
            "my_chat_member",
          ],
        },
        { url: webhookUrl, allowedUpdates: TELEGRAM_WEBHOOK_ALLOWED_UPDATES },
      );
    }).toThrow(/my_chat_member/);
  });
});
