import "server-only";

import { sign } from "@tma.js/init-data-node";

import { resolveSeedPersona } from "@/lib/db/seed-personas";

type Environment = Readonly<Record<string, string | undefined>>;

interface SignDevelopmentInitDataOptions {
  authDate?: Date;
  env?: Environment;
}

export function parseDevelopmentBotToken(
  env: Environment = process.env,
): string {
  const token = env.TMA_DEVELOPMENT_BOT_TOKEN?.trim();
  if (!token) {
    throw new Error("TMA_DEVELOPMENT_BOT_TOKEN is required in development");
  }

  return token;
}

export function signDevelopmentInitDataForPersona(
  personaName: string | null | undefined,
  options: SignDevelopmentInitDataOptions = {},
): string | null {
  const persona = resolveSeedPersona(personaName);
  if (!persona) {
    return null;
  }

  const token = parseDevelopmentBotToken(options.env);

  return sign(
    {
      user: {
        id: persona.userId,
        first_name: persona.firstName,
        is_bot: false,
        username: persona.username,
      },
    },
    token,
    options.authDate ?? new Date(),
  );
}
