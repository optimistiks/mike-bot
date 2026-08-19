import type { EventType } from "@/lib/domain/event";

import {
  HUMOR_EMOJI,
  isScoringEmoji,
  KARMA_MINUS_EMOJI,
  KARMA_PLUS_EMOJI,
} from "./emojis";

export type ReactionSkipReason = "self" | "bot_subject";

export interface ReactionEventInput {
  emojiAdded: string[];
  emojiRemoved: string[];
  actorId: number;
  subjectId: number;
  subjectIsBot: boolean;
}

export type ReactionEventResult =
  | { ok: true; eventTypes: EventType[] }
  | { ok: false; reason: ReactionSkipReason };

const ADD_TYPE: Record<string, EventType> = {
  [KARMA_PLUS_EMOJI]: "karma.plus",
  [KARMA_MINUS_EMOJI]: "karma.minus",
  [HUMOR_EMOJI]: "humor.add",
};

const REMOVE_TYPE: Record<string, EventType> = {
  [KARMA_PLUS_EMOJI]: "karma.undo.plus",
  [KARMA_MINUS_EMOJI]: "karma.undo.minus",
  [HUMOR_EMOJI]: "humor.undo.add",
};

function scoringEmojis(emojis: string[]): string[] {
  return emojis.filter(isScoringEmoji);
}

/** Pure adapter: reaction diff → append-only Event types (no DB). */
export function reactionDiffToEventTypes(
  input: ReactionEventInput,
): ReactionEventResult {
  if (input.actorId === input.subjectId) {
    return { ok: false, reason: "self" };
  }

  if (input.subjectIsBot) {
    return { ok: false, reason: "bot_subject" };
  }

  const eventTypes: EventType[] = [];

  for (const emoji of scoringEmojis(input.emojiRemoved)) {
    eventTypes.push(REMOVE_TYPE[emoji]);
  }

  for (const emoji of scoringEmojis(input.emojiAdded)) {
    eventTypes.push(ADD_TYPE[emoji]);
  }

  return { ok: true, eventTypes };
}
