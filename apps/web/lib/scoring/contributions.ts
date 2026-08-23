import type { MarkType } from "@/lib/domain/mark";

import type { BucketContributions } from "./types";

const ZERO: BucketContributions = {
  karmaReceived: 0,
  humorReceived: 0,
  karmaPlusGiven: 0,
  karmaMinusGiven: 0,
  humorGiven: 0,
};

const CONTRIBUTIONS: Record<MarkType, BucketContributions> = {
  "karma.plus": {
    ...ZERO,
    karmaReceived: 1,
    karmaPlusGiven: 1,
  },
  "karma.minus": {
    ...ZERO,
    karmaReceived: -1,
    karmaMinusGiven: 1,
  },
  "humor.add": {
    ...ZERO,
    humorReceived: 1,
    humorGiven: 1,
  },
};

export function markTypeToContributions(type: MarkType): BucketContributions {
  return CONTRIBUTIONS[type];
}
