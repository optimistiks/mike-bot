import type { ReactionType } from "grammy/types";

import type { MarkType } from "@/lib/domain/mark";

import type { MarkChange } from "./marks";

import type { ScoringReactionMap } from "./emojis";
import { reactionKey } from "./reaction-key";

export { reactionKey };

export type ReactionSkipReason = "self" | "bot_subject";

export interface ReactionEventInput {
  /** What this Chat scores by, already resolved against the defaults. */
  bindings: ScoringReactionMap;
  addedReactions: ReactionType[];
  removedReactions: ReactionType[];
  actorId: number;
  subjectId: number;
  subjectIsBot: boolean;
}

export type ReactionEventResult =
  | { ok: true; changes: MarkChange[] }
  | { ok: false; reason: ReactionSkipReason };

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

/**
 * The Marks a Chat places for these reactions.
 *
 * The filter is "is this key bound", not "is this one of three known emoji",
 * which is what lets a custom emoji score at all: `reactionKey` has always
 * named them, and only this lookup used to throw them away.
 */
function boundMarkTypes(
  reactions: ReactionType[],
  bindings: ScoringReactionMap,
): MarkType[] {
  return reactions.flatMap((reaction) => {
    // A paid reaction names no Member, so it can never place a Mark — refused
    // here and not only by `chat_scoring_reactions`' CHECK, so the rule holds
    // wherever a map comes from.
    if (reaction.type === "paid") return [];

    const type = bindings.get(reactionKey(reaction));

    return type ? [type] : [];
  });
}

/**
 * Pure adapter: reaction diff → removal-before-addition Mark changes.
 *
 * The ordering is load-bearing. Telegram delivers a 👍→👎 switch as one update,
 * and emitting the removal first is what lets the Actor correct a misclick
 * inside the Undo window: the 👍 is taken back, freeing the karma slot for the
 * 👎. Outside the window the removal does nothing and the 👎 is then refused.
 */
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

  for (const type of boundMarkTypes(input.removedReactions, input.bindings)) {
    changes.push({ action: "remove", type });
  }

  for (const type of boundMarkTypes(input.addedReactions, input.bindings)) {
    changes.push({ action: "add", type });
  }

  return { ok: true, changes };
}
