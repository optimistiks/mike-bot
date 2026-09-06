import type { User } from "grammy/types";

const UNKNOWN_LABEL = "???";

function colonless(name: string): string {
  return name.replaceAll(":", "");
}

function nonemptyOrUnknown(value: string): string {
  if (value === "") {
    return UNKNOWN_LABEL;
  }
  return value;
}

function fallbackLabel(username: string | undefined): string {
  return nonemptyOrUnknown(username?.trim() ?? "");
}

function speakerLabel(user: User): string {
  const fromName = colonless(user.first_name).trim();
  if (fromName === "") {
    return fallbackLabel(user.username);
  }
  return fromName;
}

export { speakerLabel };
