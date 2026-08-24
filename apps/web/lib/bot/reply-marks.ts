import type { MarkType } from "@/lib/domain/mark";

/** What the bot says in the Chat once it has taken the Scoring reply's place. */
const ACKNOWLEDGEMENT_LABEL: Record<MarkType, string> = {
  "karma.plus": "➕",
  "karma.minus": "➖",
  "humor.add": "лол",
};

export function replyTextToMarkType(text: string): MarkType | null {
  const normalized = text.trim();
  if (normalized === "+") return "karma.plus";
  if (normalized === "-") return "karma.minus";
  if (normalized.toLocaleLowerCase("ru-RU") === "лол") return "humor.add";
  return null;
}

/**
 * Name the Actor without mentioning them. Deliberately not `memberDisplayName`:
 * its `@username` is a real mention, and the bot answers every Mark an Actor
 * gives, so that would notify them for their own routine reactions.
 */
export function acknowledgementName(actor: {
  username?: string;
  first_name: string;
}): string {
  return actor.username ?? actor.first_name;
}

export function acknowledgementText(
  type: MarkType,
  actor: { username?: string; first_name: string },
): string {
  return `${ACKNOWLEDGEMENT_LABEL[type]} (${acknowledgementName(actor)})`;
}
