import { and, eq } from "drizzle-orm";

import type { AppDatabase } from "@/lib/db/runtime";
import { chatMemberships } from "@/lib/db/schema";

export async function hasChatMembership(
  db: AppDatabase,
  chatId: number,
  userId: number,
): Promise<boolean> {
  const memberships = await db
    .select({ chatId: chatMemberships.chatId })
    .from(chatMemberships)
    .where(
      and(
        eq(chatMemberships.chatId, chatId),
        eq(chatMemberships.userId, userId),
      ),
    )
    .limit(1);

  return memberships.length === 1;
}

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
