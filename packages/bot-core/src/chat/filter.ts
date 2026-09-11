const BANNED_PHRASES = ["без обид", "если серьезно", "я пошутил"] as const;
const EMOJI_PATTERN = /\p{Extended_Pictographic}/gu;
const LABEL_NEXT_LINE = "\n[";
const LEADING_LABELS = /^\s*(?:\[[^\]]+\]\s*)+/u;
const REPLY_PREFIX = /^в ответ .+?(?: от \d+ \S+ в \d+:\d{2})?:\s*/u;
const HEADER_COLON = /^:\s*/u;

function isBlank(text: string): boolean {
  return text.trim() === "";
}

function findBannedIndex(text: string): number {
  const lower = text.toLowerCase();
  const indexes = BANNED_PHRASES.map((phrase) => lower.indexOf(phrase)).filter(
    (index) => index !== -1,
  );
  if (indexes.length === 0) {
    return -1;
  }
  return Math.min(...indexes);
}

function hasBannedPhrase(text: string): boolean {
  return findBannedIndex(text) !== -1;
}

function cutBanned(text: string): string {
  const index = findBannedIndex(text);
  if (index === -1) {
    return text;
  }
  return text.slice(0, index);
}

function stripEmoji(text: string): string {
  EMOJI_PATTERN.lastIndex = 0;
  return text.replace(EMOJI_PATTERN, "");
}

function stripQuoteBlock(text: string): string {
  if (!text.startsWith("> ")) {
    return text;
  }
  const lines = text.split("\n");
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (line === undefined || !line.startsWith("> ")) {
      break;
    }
    index += 1;
  }
  if (lines[index] === "") {
    index += 1;
  }
  return lines.slice(index).join("\n");
}

function stripReplicaMeta(text: string): string {
  const withoutLabels = text.replace(LEADING_LABELS, "");
  const labelsPresent = withoutLabels !== text;
  let rest = text;
  if (labelsPresent) {
    rest = withoutLabels.trim().replace(REPLY_PREFIX, "").replace(HEADER_COLON, "");
  }
  return stripQuoteBlock(rest).trim();
}

function stripTrailingPeriod(text: string): string {
  if (text.endsWith(".")) {
    return text.slice(0, -1);
  }
  return text;
}

function truncateLabeledTail(text: string): string {
  const index = text.indexOf(LABEL_NEXT_LINE);
  if (index === -1) {
    return text;
  }
  return text.slice(0, index);
}

function postProcess(sample: string): string {
  const stripped = stripTrailingPeriod(stripEmoji(stripReplicaMeta(sample)));
  const truncated = stripTrailingPeriod(truncateLabeledTail(stripped)).trim();
  if (isBlank(truncated)) {
    return "";
  }
  return truncated;
}

export { cutBanned, hasBannedPhrase, isBlank, postProcess };
