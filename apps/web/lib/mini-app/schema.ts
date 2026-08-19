import { z } from "zod";

export const chatEntrySchema = z.object({
  chatId: z.number().int(),
  label: z.string(),
});

export const chatsResponseSchema = z.object({
  chats: z.array(chatEntrySchema),
});

export type ChatsResponse = z.infer<typeof chatsResponseSchema>;
