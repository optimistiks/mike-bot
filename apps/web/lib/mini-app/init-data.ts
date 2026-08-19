const TMA_PREFIX = /^tma\s+/i;

/** Toy-scope auth: parse user.id from initData without HMAC validation. */
export function parseUserIdFromInitData(initData: string): number | null {
  const params = new URLSearchParams(initData);
  const userRaw = params.get("user");
  if (!userRaw) {
    return null;
  }

  try {
    const user = JSON.parse(userRaw) as { id?: unknown };
    return typeof user.id === "number" ? user.id : null;
  } catch {
    return null;
  }
}

export function readInitDataFromAuthorization(
  authorization: string | null,
): string | null {
  if (!authorization || !TMA_PREFIX.test(authorization)) {
    return null;
  }

  const initData = authorization.replace(TMA_PREFIX, "").trim();
  return initData.length > 0 ? initData : null;
}

export function parseUserIdFromAuthorization(
  authorization: string | null,
): number | null {
  const initData = readInitDataFromAuthorization(authorization);
  if (!initData) {
    return null;
  }

  return parseUserIdFromInitData(initData);
}
