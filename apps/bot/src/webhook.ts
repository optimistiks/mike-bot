export const WEBHOOK_MAX_DURATION_SECONDS = 60;

export const TELEGRAM_WEBHOOK_ALLOWED_UPDATES = ["message", "channel_post"] as const;

export function webhookHandlerOptions(secretToken: string): {
  secretToken: string;
  timeoutMilliseconds: number;
} {
  return {
    secretToken,
    timeoutMilliseconds: (WEBHOOK_MAX_DURATION_SECONDS + 5) * 1000,
  };
}
