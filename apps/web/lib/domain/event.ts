import { z } from 'zod';

/** Closed vocabulary of v2 Event types (ADR-0004). */
export const eventTypeSchema = z.enum([
  'karma.plus',
  'karma.undo.plus',
  'karma.minus',
  'karma.undo.minus',
  'humor.add',
  'humor.undo.add',
]);

export type EventType = z.infer<typeof eventTypeSchema>;

/** Core Event row shape at API and storage boundaries. */
export const eventRecordSchema = z.object({
  type: eventTypeSchema,
  chatId: z.number().int(),
  actorId: z.number().int(),
  subjectId: z.number().int(),
  messageId: z.number().int(),
  createdAt: z.coerce.date(),
  legacyId: z.uuid().nullable().optional(),
});

export type EventRecord = z.infer<typeof eventRecordSchema>;

export const EVENT_TYPES = eventTypeSchema.options;
