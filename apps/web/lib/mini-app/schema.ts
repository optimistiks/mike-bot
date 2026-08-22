import { z } from "zod";

export const chatEntrySchema = z.object({
  chatId: z.number().int(),
  title: z.string(),
  photoVersion: z.string().nullable(),
});

export const chatsResponseSchema = z.object({
  chats: z.array(chatEntrySchema),
});

export type ChatsResponse = z.infer<typeof chatsResponseSchema>;
