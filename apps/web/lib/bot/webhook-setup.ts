/** Update types registered on the Telegram webhook (ticket 27). */
export const TELEGRAM_WEBHOOK_ALLOWED_UPDATES = [
  "message",
  "message_reaction",
  "chat_member",
] as const;

export type TelegramWebhookAllowedUpdate =
  (typeof TELEGRAM_WEBHOOK_ALLOWED_UPDATES)[number];

export interface WebhookInfoShape {
  url?: string;
  allowed_updates?: string[];
}

export interface ExpectedWebhookRegistration {
  url: string;
  allowedUpdates: readonly string[];
}

/** Verifies `getWebhookInfo` matches what `setWebhook` should have registered. */
export function assertWebhookRegistered(
  info: WebhookInfoShape,
  expected: ExpectedWebhookRegistration,
): void {
  if (!info.url) {
    throw new Error("Webhook URL missing from getWebhookInfo");
  }

  if (info.url !== expected.url) {
    throw new Error(
      `Webhook URL mismatch: expected ${expected.url}, got ${info.url}`,
    );
  }

  const registered = info.allowed_updates ?? [];

  for (const updateType of expected.allowedUpdates) {
    if (!registered.includes(updateType)) {
      throw new Error(
        `Webhook missing allowed_update "${updateType}"; got ${JSON.stringify(registered)}`,
      );
    }
  }

  if (registered.includes("my_chat_member")) {
    throw new Error(
      "Webhook includes my_chat_member; v2 uses chat_member only for leave cleanup",
    );
  }
}
