import "server-only";

// eslint-disable-next-line node/no-process-env -- env.ts is the process.env seam
const processEnv: NodeJS.ProcessEnv = process.env;

function readEnv(name: string): string | undefined {
  return processEnv[name];
}

function trimmedOrUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed === "") {
    return undefined;
  }
  return trimmed;
}

function nonempty(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return trimmedOrUndefined(value);
}

function botToken(): string | undefined {
  return nonempty(readEnv("BOT_TOKEN"));
}

function requireBotToken(): string {
  const token = botToken();
  if (token === undefined) {
    throw new Error("BOT_TOKEN is unset");
  }
  return token;
}

function isProduction(): boolean {
  return readEnv("NODE_ENV") === "production";
}

export { botToken, isProduction, requireBotToken };
