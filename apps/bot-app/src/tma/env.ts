import "server-only";
import { z } from "zod";

// eslint-disable-next-line node/no-process-env -- env.ts is the process.env seam
const processEnv: NodeJS.ProcessEnv = process.env;

const NONEMPTY_LENGTH = 1;
const botTokenSchema = z.string().trim().min(NONEMPTY_LENGTH);

function botToken(): string | undefined {
  const parsed = botTokenSchema.safeParse(processEnv.BOT_TOKEN);
  return parsed.success ? parsed.data : undefined;
}

function requireBotToken(): string {
  return botTokenSchema.parse(processEnv.BOT_TOKEN);
}

function isProduction(): boolean {
  return processEnv.NODE_ENV === "production";
}

export { botToken, isProduction, requireBotToken };
