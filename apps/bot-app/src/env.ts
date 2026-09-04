import { z } from "zod";

const NONEMPTY_LENGTH = 1;
const nonemptyString = z.string().trim().min(NONEMPTY_LENGTH);

const envSchema = z.object({
  BOT_TOKEN: nonemptyString,
  BOT_WEBHOOK_SECRET: nonemptyString,
  DATABASE_URL: nonemptyString,
});

// eslint-disable-next-line node/no-process-env -- env.ts is the process.env seam
const env = envSchema.parse(process.env);

function isProduction(): boolean {
  // eslint-disable-next-line node/no-process-env -- NODE_ENV is not an app secret
  return process.env.NODE_ENV === "production";
}

export { env, isProduction };
