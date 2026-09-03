const MARK_TYPES = ["karma.plus", "karma.minus", "humor.add"] as const;

type MarkType = (typeof MARK_TYPES)[number];

type MarkSlot = "karma" | "humor";

function markSlotForType(type: MarkType): MarkSlot {
  return type === "humor.add" ? "humor" : "karma";
}

export { MARK_TYPES, markSlotForType, type MarkSlot, type MarkType };
