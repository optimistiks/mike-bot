import { eq } from "drizzle-orm";

import type { AppDatabase } from "@/lib/db/runtime";
import { chats, registrations } from "@/lib/db/schema";

export function formatChatLabel(chatId: number): string {
  return `Чат ${String(chatId)}`;
}

export async function listChatsForUser(
  db: AppDatabase,
  userId: number,
): Promise<{ chatId: number; title: string; photoVersion: string | null }[]> {
  const rows = await db
    .select({
      chatId: registrations.chatId,
      title: chats.title,
      photoVersion: chats.photoUniqueId,
    })
    .from(registrations)
    .leftJoin(chats, eq(registrations.chatId, chats.chatId))
    .where(eq(registrations.userId, userId));

  return rows
    .map((row) => ({
      chatId: row.chatId,
      title: row.title ?? formatChatLabel(row.chatId),
      photoVersion: row.photoVersion,
    }))
    .toSorted((left, right) => left.chatId - right.chatId);
}
