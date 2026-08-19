/** Standard scoring reactions (ticket #05). */
export const KARMA_PLUS_EMOJI = "👍";
export const KARMA_MINUS_EMOJI = "👎";
export const HUMOR_EMOJI = "🤣";

export const SCORING_EMOJIS = [
  KARMA_PLUS_EMOJI,
  KARMA_MINUS_EMOJI,
  HUMOR_EMOJI,
] as const;

export type ScoringEmoji = (typeof SCORING_EMOJIS)[number];

export function isScoringEmoji(emoji: string): emoji is ScoringEmoji {
  return (SCORING_EMOJIS as readonly string[]).includes(emoji);
}
