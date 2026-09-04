import { parse, validate } from "@tma.js/init-data-node";

import type { OpenerProfile } from "./opener";

import { INIT_DATA_LIFETIME_SECONDS } from "./constants";
import { openerName, openerPhotoUrl } from "./opener";

const TMA_PREFIX = "tma ";

type ParsedInitData = ReturnType<typeof parse>;
type ParsedUser = NonNullable<ParsedInitData["user"]>;

function tmaInitData(authorization: string | null): string | null {
  if (authorization === null || !authorization.toLowerCase().startsWith(TMA_PREFIX)) {
    return null;
  }
  const value = authorization.slice(TMA_PREFIX.length).trim();
  if (value === "") {
    return null;
  }
  return value;
}

function requireUser(parsed: ParsedInitData): ParsedUser {
  if (parsed.user === undefined) {
    throw new Error("Invalid init data");
  }
  return parsed.user;
}

function openerProfile(parsed: ParsedInitData): OpenerProfile {
  const user = requireUser(parsed);
  return {
    name: openerName(user),
    photoUrl: openerPhotoUrl(user.photo_url),
  };
}

function parseValidatedProfile(initData: string, token: string): OpenerProfile {
  validate(initData, token, { expiresIn: INIT_DATA_LIFETIME_SECONDS });
  return openerProfile(parse(initData));
}

function profileFromInitData(initData: string, token: string): OpenerProfile | null {
  try {
    return parseValidatedProfile(initData, token);
  } catch {
    return null;
  }
}

function authenticateTmaOpener(authorization: string | null, token: string): OpenerProfile | null {
  const initData = tmaInitData(authorization);
  if (initData === null) {
    return null;
  }
  return profileFromInitData(initData, token);
}

export { authenticateTmaOpener };
