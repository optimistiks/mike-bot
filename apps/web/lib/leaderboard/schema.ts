import { z } from "zod";

export const seasonSchema = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
});

export const leaderboardEntrySchema = z.object({
  userId: z.number().int(),
  displayName: z.string(),
  score: z.number().int(),
  isCrown: z.boolean(),
  isChicken: z.boolean(),
});

export const leaderboardSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  entries: z.array(leaderboardEntrySchema),
});

export const leaderboardResponseSchema = z.object({
  chatId: z.number().int(),
  season: seasonSchema,
  isCurrentSeason: z.boolean(),
  sections: z.array(leaderboardSectionSchema),
});

export type LeaderboardResponse = z.infer<typeof leaderboardResponseSchema>;

export const leaderboardQuerySchema = z
  .object({
    chat_id: z.coerce.number().int(),
    year: z.coerce.number().int().optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
  })
  .superRefine((query, context) => {
    const hasYear = query.year !== undefined;
    const hasMonth = query.month !== undefined;

    if (hasYear !== hasMonth) {
      context.addIssue({
        code: "custom",
        message: "year and month must be provided together",
        path: hasYear ? ["month"] : ["year"],
      });
    }
  })
  .transform((query) => ({
    chatId: query.chat_id,
    year: query.year,
    month: query.month,
  }));

export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;
