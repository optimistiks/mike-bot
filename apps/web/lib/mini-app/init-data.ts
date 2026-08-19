import { parse, validate } from "@tma.js/init-data-node";

const TMA_AUTHORIZATION = /^tma\s+(.+)$/i;
const INIT_DATA_LIFETIME_SECONDS = 365 * 24 * 60 * 60;
const MAX_FUTURE_CLOCK_SKEW_MS = 60_000;

export interface AuthenticatedMember {
  userId: number;
}

/** Validate Telegram-signed launch data before exposing the Member identity. */
export function authenticateTmaMember(
  authorization: string | null,
  botToken: string,
): AuthenticatedMember | null {
  const match = authorization?.match(TMA_AUTHORIZATION);
  const initData = match?.[1]?.trim();
  if (!initData) {
    return null;
  }

  try {
    validate(initData, botToken, { expiresIn: INIT_DATA_LIFETIME_SECONDS });
    const parsed = parse(initData);

    if (
      parsed.auth_date.getTime() > Date.now() + MAX_FUTURE_CLOCK_SKEW_MS ||
      !parsed.user ||
      !Number.isSafeInteger(parsed.user.id)
    ) {
      return null;
    }

    return { userId: parsed.user.id };
  } catch {
    return null;
  }
}
