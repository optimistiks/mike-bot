import { eq } from "drizzle-orm";

import type { AppDatabase } from "@/lib/db/runtime";
import { registrations } from "@/lib/db/schema";

export function formatChatLabel(chatId: number): string {
  return `Чат ${String(chatId)}`;
}

export async function listChatsForUser(
  db: AppDatabase,
  userId: number,
): Promise<{ chatId: number; label: string }[]> {
  const rows = await db
    .select({ chatId: registrations.chatId })
    .from(registrations)
    .where(eq(registrations.userId, userId));

  return rows
    .map((row) => ({
      chatId: row.chatId,
      label: formatChatLabel(row.chatId),
    }))
    .toSorted((left, right) => left.chatId - right.chatId);
}
