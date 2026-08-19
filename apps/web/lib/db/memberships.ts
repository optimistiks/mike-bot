import { and, eq } from "drizzle-orm";

import type { AppDatabase } from "@/lib/db/runtime";
import { chatMemberships } from "@/lib/db/schema";

export async function addChatMembership(
  db: AppDatabase,
  chatId: number,
  userId: number,
): Promise<void> {
  await db
    .insert(chatMemberships)
    .values({ chatId, userId })
    .onConflictDoNothing();
}

export async function removeChatMembership(
  db: AppDatabase,
  chatId: number,
  userId: number,
): Promise<void> {
  await db
    .delete(chatMemberships)
    .where(
      and(
        eq(chatMemberships.chatId, chatId),
        eq(chatMemberships.userId, userId),
      ),
    );
}

export async function clearChatMemberships(
  db: AppDatabase,
  chatId: number,
): Promise<void> {
  await db.delete(chatMemberships).where(eq(chatMemberships.chatId, chatId));
}
