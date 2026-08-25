import { z } from "zod";

import { isReactionKey } from "@/lib/bot/reaction-key";
import { markTypeSchema } from "@/lib/domain/mark";

/**
 * The key naming one reaction, in the shape `reactionKey()` produces.
 *
 * `paid` is deliberately unmatched: it names no Member and can never place a
 * Mark, which is also what the table's CHECK says.
 */
export const reactionKeySchema = z
  .string()
  .min(1)
  .max(128)
  .refine(isReactionKey, { message: "Unknown reaction" });

export const chatReactionSchema = z.object({
  reactionKey: reactionKeySchema,
  label: z.string().nullable(),
  markType: markTypeSchema.nullable(),
});
export type ChatReactionView = z.infer<typeof chatReactionSchema>;

export const scoringReactionsResponseSchema = z.object({
  /**
   * Every reaction in the Chat's palette, bound or not — one entry per key,
   * exactly as stored. The Mini App groups them by Mark; the wire does not,
   * because a reaction holds at most one Mark and a grouped shape could
   * express otherwise.
   */
  reactions: z.array(chatReactionSchema),
  /** True while the Chat has never saved and is scoring by the built-in map. */
  usingDefaults: z.boolean(),
  /** Whether this caller may save. Registration views; administration changes. */
  canEdit: z.boolean(),
});
export type ScoringReactionsResponse = z.infer<
  typeof scoringReactionsResponseSchema
>;

/**
 * Every Reaction binding a Chat should end up with, not a diff.
 *
 * The client sends every binding it wants, so two administrators saving at once
 * produce one of the two intents rather than a merge of both. A reaction may
 * appear at most once across the three lists — the same rule the primary key
 * enforces in storage, restated here so a hand-written request cannot ask for a
 * state the table could not hold.
 */
export const scoringReactionsRequestSchema = z
  .object({
    // `partialRecord`, not `record`: a plain record over an enum key demands
    // every Mark be present, and a Chat that binds nothing to Karma minus
    // simply omits it.
    bindings: z.partialRecord(markTypeSchema, z.array(reactionKeySchema)),
  })
  .superRefine((value, context) => {
    const seen = new Set<string>();

    for (const keys of Object.values(value.bindings)) {
      for (const key of keys) {
        if (seen.has(key)) {
          context.addIssue({
            code: "custom",
            path: ["bindings"],
            message: `Reaction ${key} is bound to more than one Mark`,
          });

          return;
        }

        seen.add(key);
      }
    }
  });
export type ScoringReactionsRequest = z.infer<
  typeof scoringReactionsRequestSchema
>;
