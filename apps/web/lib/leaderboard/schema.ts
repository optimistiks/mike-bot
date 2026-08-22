import { z } from "zod";

export const seasonSchema = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
});

export const leaderboardPeriodSchema = z.discriminatedUnion("kind", [
  seasonSchema.extend({ kind: z.literal("season") }),
  z.object({ kind: z.literal("year"), year: z.number().int() }),
]);

export type LeaderboardPeriod = z.infer<typeof leaderboardPeriodSchema>;

export const leaderboardEntrySchema = z.object({
  userId: z.number().int(),
  displayName: z.string(),
  score: z.number().int(),
  isCrown: z.boolean(),
  isChicken: z.boolean(),
});
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;

export const leaderboardSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  entries: z.array(leaderboardEntrySchema),
});
export type LeaderboardSection = z.infer<typeof leaderboardSectionSchema>;

export const leaderboardResponseSchema = z.object({
  chatId: z.number().int(),
  period: leaderboardPeriodSchema,
  sections: z.array(leaderboardSectionSchema),
});

export type LeaderboardResponse = z.infer<typeof leaderboardResponseSchema>;

export const availablePeriodsResponseSchema = z.object({
  seasons: z.array(seasonSchema),
});
export type AvailablePeriodsResponse = z.infer<
  typeof availablePeriodsResponseSchema
>;

export const leaderboardQuerySchema = z
  .object({
    chat_id: z.coerce.number().int(),
    year: z.coerce.number().int().optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
  })
  .superRefine((query, context) => {
    const hasYear = query.year !== undefined;
    const hasMonth = query.month !== undefined;

    if (!hasYear && hasMonth) {
      context.addIssue({
        code: "custom",
        message: "month requires year",
        path: ["year"],
      });
    }
  })
  .transform((query) => ({
    chatId: query.chat_id,
    year: query.year,
    month: query.month,
  }));

export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;
