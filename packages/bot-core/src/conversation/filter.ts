import { EMPTY_COUNT, FIRST_INDEX, LAST_FROM_END, SINGLE_COUNT } from "#src/constants.js";

const BANNED_PHRASES = ["без обид", "если серьезно", "я пошутил"] as const;
const EMOJI_PATTERN = /\p{Extended_Pictographic}/gu;
const LABEL_NEXT_LINE = "\n[";
const MAX_SENTENCES = 2;
const SENTENCE_ENDINGS = new Set([".", "!", "?", "\n"]);

interface FilterResult {
  filters: string[];
  text: string;
}

function isBlank(text: string): boolean {
  return text.trim() === "";
}

function findBannedIndex(text: string): number {
  const lower = text.toLowerCase();
  const indexes = BANNED_PHRASES.map((phrase) => lower.indexOf(phrase)).filter(
    (index) => index >= EMPTY_COUNT,
  );
  if (indexes.length === EMPTY_COUNT) {
    return LAST_FROM_END;
  }
  return Math.min(...indexes);
}

function hasBannedPhrase(text: string): boolean {
  return findBannedIndex(text) >= EMPTY_COUNT;
}

function cutBanned(text: string): string {
  const index = findBannedIndex(text);
  if (index < EMPTY_COUNT) {
    return text;
  }
  return text.slice(FIRST_INDEX, index);
}

function withFilter(result: FilterResult, next: string, filter: string): FilterResult {
  if (next === result.text) {
    return result;
  }
  return { filters: [...result.filters, filter], text: next };
}

function applyLabelTruncate(result: FilterResult): FilterResult {
  const index = result.text.indexOf(LABEL_NEXT_LINE);
  if (index < EMPTY_COUNT) {
    return result;
  }
  return withFilter(result, result.text.slice(FIRST_INDEX, index), "label-truncate");
}

function stripEmoji(text: string): string {
  EMOJI_PATTERN.lastIndex = EMPTY_COUNT;
  return text.replace(EMOJI_PATTERN, "");
}

function applyEmoji(result: FilterResult): FilterResult {
  return withFilter(result, stripEmoji(result.text), "emoji");
}

function isSentenceEnd(character: string | undefined): boolean {
  if (character === undefined) {
    return false;
  }
  return SENTENCE_ENDINGS.has(character);
}

function remainingAfter(character: string | undefined, remaining: number): number {
  if (isSentenceEnd(character)) {
    return remaining - SINGLE_COUNT;
  }
  return remaining;
}

function nthSentenceEndFrom(text: string, remaining: number, index: number): number {
  if (index >= text.length) {
    return LAST_FROM_END;
  }
  const nextRemaining = remainingAfter(text.charAt(index), remaining);
  if (nextRemaining === EMPTY_COUNT) {
    return index + SINGLE_COUNT;
  }
  return nthSentenceEndFrom(text, nextRemaining, index + SINGLE_COUNT);
}

function nthSentenceEnd(text: string, count: number): number {
  return nthSentenceEndFrom(text, count, EMPTY_COUNT);
}

function cutAfterSentences(text: string): string {
  const end = nthSentenceEnd(text, MAX_SENTENCES);
  if (end < EMPTY_COUNT) {
    return text;
  }
  return text.slice(FIRST_INDEX, end);
}

function applySentenceCap(result: FilterResult): FilterResult {
  return withFilter(result, cutAfterSentences(result.text), "sentence-cap");
}

function stripTrailingPeriod(text: string): string {
  if (text.endsWith(".")) {
    return text.slice(FIRST_INDEX, LAST_FROM_END);
  }
  return text;
}

function finalize(result: FilterResult): FilterResult {
  const text = stripTrailingPeriod(result.text).trim();
  if (isBlank(text)) {
    return { filters: [...result.filters, "empty"], text: "" };
  }
  return { filters: result.filters, text };
}

function applyTrailingPeriod(result: FilterResult): FilterResult {
  return { filters: result.filters, text: stripTrailingPeriod(result.text) };
}

function postProcess(sample: string): FilterResult {
  const withoutEmoji = applyEmoji({ filters: [], text: sample });
  const capped = applySentenceCap(withoutEmoji);
  const noPeriod = applyTrailingPeriod(capped);
  return finalize(applyLabelTruncate(noPeriod));
}

export { cutBanned, hasBannedPhrase, isBlank, postProcess };
