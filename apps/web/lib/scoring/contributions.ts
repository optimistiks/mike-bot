import type { EventType } from "@/lib/domain/event";

import type { BucketContributions } from "./types";

const ZERO: BucketContributions = {
  karmaReceived: 0,
  humorReceived: 0,
  karmaPlusGiven: 0,
  karmaMinusGiven: 0,
  humorGiven: 0,
};

const CONTRIBUTIONS: Record<EventType, BucketContributions> = {
  "karma.plus": {
    ...ZERO,
    karmaReceived: 1,
    karmaPlusGiven: 1,
  },
  "karma.undo.plus": {
    ...ZERO,
    karmaReceived: -1,
    karmaPlusGiven: -1,
  },
  "karma.minus": {
    ...ZERO,
    karmaReceived: -1,
    karmaMinusGiven: 1,
  },
  "karma.undo.minus": {
    ...ZERO,
    karmaReceived: 1,
    karmaMinusGiven: -1,
  },
  "humor.add": {
    ...ZERO,
    humorReceived: 1,
    humorGiven: 1,
  },
  "humor.undo.add": {
    ...ZERO,
    humorReceived: -1,
    humorGiven: -1,
  },
};

export function eventTypeToContributions(type: EventType): BucketContributions {
  return CONTRIBUTIONS[type];
}
