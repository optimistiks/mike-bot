export const MARK_TYPES = ["karma.plus", "karma.minus", "humor.add"] as const;

export type MarkType = (typeof MARK_TYPES)[number];

export type MarkSlot = "karma" | "humor";

export function markSlotForType(type: MarkType): MarkSlot {
  return type === "humor.add" ? "humor" : "karma";
}
