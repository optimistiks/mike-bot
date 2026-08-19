import { z } from 'zod';

/** Import `parseServerEnv` from `./env.server` in Route Handlers and Server Components. */
export const serverEnvSchema = z.object({
  BOT_TOKEN: z.string().min(1),
  BOT_WEBHOOK_SECRET: z.string().min(1),
  DATABASE_URL: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(
  env: Record<string, string | undefined> = process.env,
): ServerEnv {
  return serverEnvSchema.parse({
    BOT_TOKEN: env.BOT_TOKEN,
    BOT_WEBHOOK_SECRET: env.BOT_WEBHOOK_SECRET,
    DATABASE_URL: env.DATABASE_URL,
  });
}
