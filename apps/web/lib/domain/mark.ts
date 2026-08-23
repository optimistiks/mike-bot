import { z } from "zod";

/** Closed vocabulary of Mark types (ADR-0015). */
export const markTypeSchema = z.enum([
  "karma.plus",
  "karma.minus",
  "humor.add",
]);

export type MarkType = z.infer<typeof markTypeSchema>;

/**
 * The grant a Mark spends. An Actor holds one `karma` and one `humor` point per
 * other Member's Message, so `karma.plus` and `karma.minus` share a slot and are
 * mutually exclusive, while Humor is independent.
 */
export const markSlotSchema = z.enum(["karma", "humor"]);

export type MarkSlot = z.infer<typeof markSlotSchema>;

/**
 * The input a Mark came from, and the only thing that decides whether it can be
 * taken back: a reaction can be removed, a reply cannot be un-sent. Imported v1
 * Marks are `reply` Marks — v1 had no reactions — and are told apart from native
 * ones by `legacyId` alone.
 */
export const markSourceSchema = z.enum(["reaction", "reply"]);

export type MarkSource = z.infer<typeof markSourceSchema>;

export function markSlotForType(type: MarkType): MarkSlot {
  return type === "humor.add" ? "humor" : "karma";
}

/** Core Mark row shape at API and storage boundaries. */
export const markRecordSchema = z.object({
  type: markTypeSchema,
  chatId: z.number().int(),
  actorId: z.number().int(),
  subjectId: z.number().int(),
  messageId: z.number().int(),
  createdAt: z.coerce.date(),
  source: markSourceSchema,
  legacyId: z.uuid().nullable().optional(),
});

export type MarkRecord = z.infer<typeof markRecordSchema>;

export const MARK_TYPES = markTypeSchema.options;
export const MARK_SLOTS = markSlotSchema.options;
