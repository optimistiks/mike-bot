import type { ReactionTypeEmoji } from "grammy/types";

import type { MarkType } from "@/lib/domain/mark";

/** The bindings every Chat starts with, until it configures its own. */
export const KARMA_PLUS_EMOJI = "👍";
export const KARMA_MINUS_EMOJI = "👎";
export const HUMOR_EMOJI = "🤣";

/**
 * What a Chat scores by: the Mark each reaction places, keyed by the string
 * `reactionKey` produces.
 */
export type ScoringReactionMap = ReadonlyMap<string, MarkType>;

/**
 * The bindings a Chat has until it saves its own (ADR-0019).
 *
 * A Chat with no rows in `chat_scoring_reactions` scores by exactly these, which
 * is what lets the feature ship without backfilling every existing Chat.
 */
export const DEFAULT_SCORING_REACTIONS: ScoringReactionMap = new Map<
  string,
  MarkType
>([
  [`emoji:${KARMA_PLUS_EMOJI}`, "karma.plus"],
  [`emoji:${KARMA_MINUS_EMOJI}`, "karma.minus"],
  [`emoji:${HUMOR_EMOJI}`, "humor.add"],
]);

/**
 * Telegram's fixed set of standard reaction emoji.
 *
 * A Chat cannot score by an emoji Telegram will not let anyone react with, so
 * binding one would be a Mark that silently never fires. Typed as grammY's own
 * union so the compiler checks every entry against the Bot API rather than
 * trusting this list to have been transcribed correctly — and note the union
 * carries no variation selectors, which is why `normalizeReactionEmoji` strips
 * U+FE0F before comparing.
 */
const TELEGRAM_REACTION_EMOJI_LIST: readonly ReactionTypeEmoji["emoji"][] = [
  "👍",
  "👎",
  "❤",
  "🔥",
  "🥰",
  "👏",
  "😁",
  "🤔",
  "🤯",
  "😱",
  "🤬",
  "😢",
  "🎉",
  "🤩",
  "🤮",
  "💩",
  "🙏",
  "👌",
  "🕊",
  "🤡",
  "🥱",
  "🥴",
  "😍",
  "🐳",
  "❤‍🔥",
  "🌚",
  "🌭",
  "💯",
  "🤣",
  "⚡",
  "🍌",
  "🏆",
  "💔",
  "🤨",
  "😐",
  "🍓",
  "🍾",
  "💋",
  "🖕",
  "😈",
  "😴",
  "😭",
  "🤓",
  "👻",
  "👨‍💻",
  "👀",
  "🎃",
  "🙈",
  "😇",
  "😨",
  "🤝",
  "✍",
  "🤗",
  "🫡",
  "🎅",
  "🎄",
  "☃",
  "💅",
  "🤪",
  "🗿",
  "🆒",
  "💘",
  "🙉",
  "🦄",
  "😘",
  "💊",
  "🙊",
  "😎",
  "👾",
  "🤷‍♂",
  "🤷",
  "🤷‍♀",
  "😡",
];

export const TELEGRAM_REACTION_EMOJI: ReadonlySet<string> = new Set(
  TELEGRAM_REACTION_EMOJI_LIST,
);

/**
 * Drop the emoji variation selector before comparing or keying.
 *
 * A person typing ❤️ into `/addreaction` sends U+2764 U+FE0F, while Telegram
 * names that same reaction ❤ (U+2764 alone). Without this they are two
 * different keys and the binding never fires.
 */
export function normalizeReactionEmoji(emoji: string): string {
  return emoji.replaceAll("\uFE0F", "");
}

/** Whether Telegram allows this standard emoji as a reaction at all. */
export function isTelegramReactionEmoji(emoji: string): boolean {
  return TELEGRAM_REACTION_EMOJI.has(normalizeReactionEmoji(emoji));
}
