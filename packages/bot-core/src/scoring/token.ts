import type { MarkType } from "#src/domain/mark.js";

const MARK_BY_TOKEN: Record<string, MarkType> = {
  "+": "karma.plus",
  "-": "karma.minus",
  лол: "humor.add",
};

const ACKNOWLEDGEMENT_LABEL: Record<MarkType, string> = {
  "humor.add": "лол",
  "karma.minus": "\u2796",
  "karma.plus": "\u2795",
};

function canonicalScoringToken(text: string): string {
  const trimmed = text.trim();
  if (trimmed === "+" || trimmed === "-") {
    return trimmed;
  }
  return trimmed.toLowerCase();
}

function scoringToken(text: string): MarkType | null {
  return MARK_BY_TOKEN[canonicalScoringToken(text)] ?? null;
}

function acknowledgementText(type: MarkType, username: string | undefined): string {
  return `${ACKNOWLEDGEMENT_LABEL[type]} (${username ?? "???"})`;
}

export { acknowledgementText, scoringToken };
