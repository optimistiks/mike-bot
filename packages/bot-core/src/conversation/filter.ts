const BANNED_PHRASES = ["без обид", "если серьезно", "я пошутил"] as const;
const EMOJI_PATTERN = /\p{Extended_Pictographic}/gu;
const LABEL_NEXT_LINE = "\n[";
const LEADING_LABELS = /^\s*(?:\[[^\]]+\]\s*)+/u;

function isBlank(text: string): boolean {
  return text.trim() === "";
}

function findBannedIndex(text: string): number {
  const lower = text.toLowerCase();
  const indexes = BANNED_PHRASES.map((phrase) => lower.indexOf(phrase)).filter(
    (index) => index >= 0,
  );
  if (indexes.length === 0) {
    return -1;
  }
  return Math.min(...indexes);
}

function hasBannedPhrase(text: string): boolean {
  return findBannedIndex(text) >= 0;
}

function cutBanned(text: string): string {
  const index = findBannedIndex(text);
  if (index < 0) {
    return text;
  }
  return text.slice(0, index);
}

function stripEmoji(text: string): string {
  EMOJI_PATTERN.lastIndex = 0;
  return text.replace(EMOJI_PATTERN, "");
}

function stripLeadingLabels(text: string): string {
  const next = text.replace(LEADING_LABELS, "");
  if (next === text) {
    return text;
  }
  return next.trim();
}

function stripTrailingPeriod(text: string): string {
  if (text.endsWith(".")) {
    return text.slice(0, -1);
  }
  return text;
}

function truncateLabeledTail(text: string): string {
  const index = text.indexOf(LABEL_NEXT_LINE);
  if (index < 0) {
    return text;
  }
  return text.slice(0, index);
}

function postProcess(sample: string): string {
  const stripped = stripTrailingPeriod(stripEmoji(stripLeadingLabels(sample)));
  const truncated = stripTrailingPeriod(truncateLabeledTail(stripped)).trim();
  if (isBlank(truncated)) {
    return "";
  }
  return truncated;
}

export { cutBanned, hasBannedPhrase, isBlank, postProcess };
