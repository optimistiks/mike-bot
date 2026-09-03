import type { MarkType } from "../domain/mark.js";

export function scoringToken(text: string): MarkType | null {
  const trimmed = text.trim();
  if (trimmed === "+") return "karma.plus";
  if (trimmed === "-") return "karma.minus";
  if (trimmed.toLowerCase() === "лол") return "humor.add";
  return null;
}

const ACKNOWLEDGEMENT_LABEL: Record<MarkType, string> = {
  "karma.plus": "\u2795",
  "karma.minus": "\u2796",
  "humor.add": "лол",
};

export function acknowledgementText(type: MarkType, username: string | undefined): string {
  return `${ACKNOWLEDGEMENT_LABEL[type]} (${username ?? "???"})`;
}
