import { FIRST_CHAR, FIRST_INDEX } from "./constants";
import { isRecord, nonemptyString } from "./record";

interface NamedOpener {
  first_name: string;
  username?: string;
}

function openerName(user: NamedOpener): string {
  if (user.username === undefined || user.username === "") {
    return user.first_name;
  }
  return `@${user.username}`;
}

function openerPhotoUrl(photoUrl: string | undefined): string | null {
  if (photoUrl === undefined || photoUrl === "") {
    return null;
  }
  return photoUrl;
}

function openerInitial(name: string): string {
  return name.replace(/^@/u, "").slice(FIRST_INDEX, FIRST_CHAR).toUpperCase();
}

interface OpenerProfile {
  name: string;
  photoUrl: string | null;
}

function openerProfileFromUnknown(data: unknown): OpenerProfile | null {
  if (!isRecord(data)) {
    return null;
  }
  const name = nonemptyString(data.name);
  if (name === undefined) {
    return null;
  }
  return { name, photoUrl: openerPhotoUrl(nonemptyString(data.photoUrl)) };
}

export { openerInitial, openerName, openerPhotoUrl, openerProfileFromUnknown, type OpenerProfile };
