import { z } from "zod";

export const webhookSecretSchema = z
  .string()
  .regex(
    /^[A-Za-z0-9_-]{1,256}$/,
    "BOT_WEBHOOK_SECRET must be 1-256 letters, digits, underscores, or hyphens",
  );

/** Import `parseServerEnv` from `./env.server` in Route Handlers and Server Components. */
export const serverEnvSchema = z.object({
  BOT_TOKEN: z.string().trim().min(1),
  BOT_WEBHOOK_SECRET: webhookSecretSchema,
  DATABASE_URL: z.string().trim().min(1, "DATABASE_URL is required"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseBotToken(
  env: Record<string, string | undefined> = process.env,
): string {
  return serverEnvSchema.shape.BOT_TOKEN.parse(env.BOT_TOKEN);
}

export function parseDatabaseUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  return serverEnvSchema.shape.DATABASE_URL.parse(env.DATABASE_URL);
}

export function parseWebhookSecret(
  env: Record<string, string | undefined> = process.env,
): string {
  return serverEnvSchema.shape.BOT_WEBHOOK_SECRET.parse(env.BOT_WEBHOOK_SECRET);
}

export function parseServerEnv(
  env: Record<string, string | undefined> = process.env,
): ServerEnv {
  return serverEnvSchema.parse({
    BOT_TOKEN: env.BOT_TOKEN,
    BOT_WEBHOOK_SECRET: env.BOT_WEBHOOK_SECRET,
    DATABASE_URL: env.DATABASE_URL,
  });
}
