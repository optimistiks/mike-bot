import { and, eq } from "drizzle-orm";

import type { AppDatabase } from "@/lib/db/runtime";
import { registrations } from "@/lib/db/schema";

export async function hasRegistration(
  db: AppDatabase,
  chatId: number,
  userId: number,
): Promise<boolean> {
  const rows = await db
    .select({ chatId: registrations.chatId })
    .from(registrations)
    .where(
      and(eq(registrations.chatId, chatId), eq(registrations.userId, userId)),
    )
    .limit(1);

  return rows.length === 1;
}

export async function addRegistration(
  db: AppDatabase,
  chatId: number,
  userId: number,
): Promise<void> {
  await db
    .insert(registrations)
    .values({ chatId, userId })
    .onConflictDoNothing();
}

export async function removeRegistration(
  db: AppDatabase,
  chatId: number,
  userId: number,
): Promise<void> {
  await db
    .delete(registrations)
    .where(
      and(eq(registrations.chatId, chatId), eq(registrations.userId, userId)),
    );
}
