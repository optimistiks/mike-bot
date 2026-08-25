import type { ReactionType } from "grammy/types";

import { normalizeReactionEmoji } from "./emojis";

const EMOJI_PREFIX = "emoji:";
const CUSTOM_EMOJI_PREFIX = "custom_emoji:";

/**
 * The stable name of one reaction, and the key a Chat binds a Mark to.
 *
 * This string is persisted in `chat_scoring_reactions`, so its shape is a
 * compatibility surface: changing it orphans every binding already stored.
 * That is why every place that builds, reads, or validates the shape lives in
 * this file — the table's CHECK constraint is the only other statement of it.
 *
 * `paid` is named for the reaction diff's benefit but is never bindable: it
 * says nothing about which Member reacted.
 */
export function reactionKey(reaction: ReactionType): string {
  switch (reaction.type) {
    case "emoji":
      return `${EMOJI_PREFIX}${normalizeReactionEmoji(reaction.emoji)}`;
    case "custom_emoji":
      return `${CUSTOM_EMOJI_PREFIX}${reaction.custom_emoji_id}`;
    case "paid":
      return "paid";
  }
}

export function standardReactionKey(emoji: string): string {
  return `${EMOJI_PREFIX}${normalizeReactionEmoji(emoji)}`;
}

export function customReactionKey(customEmojiId: string): string {
  return `${CUSTOM_EMOJI_PREFIX}${customEmojiId}`;
}

/** Whether a string is a shape a Chat could ever have bound. */
export function isReactionKey(value: string): boolean {
  return (
    value.startsWith(EMOJI_PREFIX) || value.startsWith(CUSTOM_EMOJI_PREFIX)
  );
}

/** The emoji a standard reaction key names, or null for a custom one. */
export function reactionKeyEmoji(reactionKey: string): string | null {
  return reactionKey.startsWith(EMOJI_PREFIX)
    ? reactionKey.slice(EMOJI_PREFIX.length)
    : null;
}

/**
 * What to call a reaction on screen.
 *
 * A standard reaction is its own name. A custom one borrows the stand-in
 * Telegram showed beneath its entity, and falls back to `fallback` when there
 * was none — the Bot API cannot render a custom emoji the bot was never told
 * about.
 */
export function reactionDisplayLabel(
  reactionKey: string,
  label: string | null,
  fallback = "реакция",
): string {
  return reactionKeyEmoji(reactionKey) ?? label ?? fallback;
}
