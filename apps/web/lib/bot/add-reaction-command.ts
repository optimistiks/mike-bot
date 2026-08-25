import type { Message } from "grammy/types";

import { isTelegramReactionEmoji, normalizeReactionEmoji } from "./emojis";
import { customReactionKey, standardReactionKey } from "./reaction-key";

/**
 * Why an `/addreaction` argument named no reaction.
 *
 * `not_a_reaction` is the one worth having: Telegram accepts only a fixed set
 * of standard emoji as reactions, so binding anything else would be a Mark that
 * silently never fires, with nothing in the Chat to say why.
 */
export type AddReactionRefusal = "missing" | "unparseable" | "not_a_reaction";

export type AddReactionArgument =
  | { ok: true; reactionKey: string; label: string | null }
  | { ok: false; reason: AddReactionRefusal };

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/**
 * The reaction an `/addreaction` message names.
 *
 * Pure: the emoji travels in the command message, so nothing here needs the
 * Chat, the network, or a clock. A custom emoji arrives as an entity carrying
 * its id, and Telegram puts a stand-in emoji in the text underneath it — that
 * stand-in becomes the label, which is what lets the Mini App draw a custom
 * reaction without ever calling Telegram for it.
 */
export function parseAddReactionArgument(
  message: Message,
): AddReactionArgument {
  const text = message.text;
  const command = message.entities?.at(0);
  if (!text || !command) return { ok: false, reason: "missing" };

  const custom = message.entities?.find(
    (entity) =>
      entity.type === "custom_emoji" && entity.offset >= command.length,
  );

  if (custom?.type === "custom_emoji") {
    const standIn = text
      .slice(custom.offset, custom.offset + custom.length)
      .trim();

    return {
      ok: true,
      reactionKey: customReactionKey(custom.custom_emoji_id),
      label: standIn === "" ? null : standIn,
    };
  }

  const argument = text.slice(command.length).trim();
  if (argument === "") return { ok: false, reason: "missing" };

  // Count graphemes, not code points: 👩‍👩‍👧 and 👍🏽 are each one reaction but
  // several code points, and `[...argument].length` would refuse both.
  const segments = [...graphemes.segment(argument)];
  if (segments.length !== 1) {
    return { ok: false, reason: "unparseable" };
  }

  const emoji = normalizeReactionEmoji(segments[0].segment);
  if (!isTelegramReactionEmoji(emoji)) {
    return { ok: false, reason: "not_a_reaction" };
  }

  return { ok: true, reactionKey: standardReactionKey(emoji), label: null };
}

/** What the bot says back, only ever to the Member who ran the command. */
export const ADD_REACTION_REFUSAL_TEXT: Record<AddReactionRefusal, string> = {
  missing: "Укажите реакцию: /addreaction 🤡",
  unparseable: "Не понял реакцию. Пришлите ровно один эмодзи.",
  not_a_reaction: "Телеграм не разрешает этот эмодзи как реакцию.",
};

export function addReactionAddedText(label: string): string {
  return `Реакция ${label} добавлена. Назначьте ей оценку в настройках группы.`;
}

export function addReactionAlreadyPresentText(label: string): string {
  return `Реакция ${label} уже в списке этой группы.`;
}
