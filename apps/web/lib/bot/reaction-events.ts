import type { ReactionType } from "grammy/types";

import type { EventType } from "@/lib/domain/event";

import type { MarkChange } from "./marks";

import {
  HUMOR_EMOJI,
  isScoringEmoji,
  KARMA_MINUS_EMOJI,
  KARMA_PLUS_EMOJI,
} from "./emojis";

export type ReactionSkipReason = "self" | "bot_subject";

export interface ReactionEventInput {
  addedReactions: ReactionType[];
  removedReactions: ReactionType[];
  actorId: number;
  subjectId: number;
  subjectIsBot: boolean;
}

export type ReactionEventResult =
  | { ok: true; changes: MarkChange[] }
  | { ok: false; reason: ReactionSkipReason };

const ADD_TYPE: Record<string, EventType> = {
  [KARMA_PLUS_EMOJI]: "karma.plus",
  [KARMA_MINUS_EMOJI]: "karma.minus",
  [HUMOR_EMOJI]: "humor.add",
};

function reactionKey(reaction: ReactionType): string {
  switch (reaction.type) {
    case "emoji":
      return `emoji:${reaction.emoji}`;
    case "custom_emoji":
      return `custom_emoji:${reaction.custom_emoji_id}`;
    case "paid":
      return "paid";
  }
}

export function diffReactionStates(
  oldReactions: ReactionType[],
  newReactions: ReactionType[],
): { addedReactions: ReactionType[]; removedReactions: ReactionType[] } {
  const oldKeys = new Set(oldReactions.map(reactionKey));
  const newKeys = new Set(newReactions.map(reactionKey));

  return {
    addedReactions: newReactions.filter(
      (reaction) => !oldKeys.has(reactionKey(reaction)),
    ),
    removedReactions: oldReactions.filter(
      (reaction) => !newKeys.has(reactionKey(reaction)),
    ),
  };
}

function scoringEmojis(reactions: ReactionType[]): string[] {
  return reactions.flatMap((reaction) =>
    reaction.type === "emoji" && isScoringEmoji(reaction.emoji)
      ? [reaction.emoji]
      : [],
  );
}

/** Pure adapter: reaction diff → removal-before-addition Mark changes. */
export function reactionDiffToMarkChanges(
  input: ReactionEventInput,
): ReactionEventResult {
  if (input.actorId === input.subjectId) {
    return { ok: false, reason: "self" };
  }

  if (input.subjectIsBot) {
    return { ok: false, reason: "bot_subject" };
  }

  const changes: MarkChange[] = [];

  for (const emoji of scoringEmojis(input.removedReactions)) {
    changes.push({ action: "remove", type: ADD_TYPE[emoji] });
  }

  for (const emoji of scoringEmojis(input.addedReactions)) {
    changes.push({ action: "add", type: ADD_TYPE[emoji] });
  }

  return { ok: true, changes };
}
