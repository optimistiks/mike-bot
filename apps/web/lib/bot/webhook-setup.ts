/**
 * How long the webhook Route Handler may run. Telegram redelivers an update it
 * gets no answer for, and `processed_updates` makes that safe, so the ceiling
 * only needs to be generous enough for a cold start plus a database wake-up.
 */
export const WEBHOOK_MAX_DURATION_SECONDS = 60;

/**
 * Options for grammY's `webhookCallback`.
 *
 * grammY otherwise gives up after ten seconds and reports a failure *without*
 * stopping the work still running: Telegram reads that as "retry" and a slow
 * update becomes two invocations. Letting the function's own limit be the only
 * deadline keeps one update to one run.
 */
export function webhookHandlerOptions(secretToken: string): {
  secretToken: string;
  timeoutMilliseconds: number;
} {
  return {
    secretToken,
    timeoutMilliseconds: (WEBHOOK_MAX_DURATION_SECONDS + 5) * 1_000,
  };
}

/**
 * Update types registered on the Telegram webhook (ticket 27).
 *
 * `edited_message` is deliberately absent: editing a message into a `+` after
 * the fact would be an easy way to mark without anyone seeing it happen.
 * `message_reaction_count` is absent too — it carries totals rather than an
 * Actor, and a Mark with no Actor is not a Mark this model can store.
 */
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
