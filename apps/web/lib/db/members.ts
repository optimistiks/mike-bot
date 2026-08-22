import { and, eq } from "drizzle-orm";

import type { AppDatabase } from "@/lib/db/runtime";
import { displayIdentities, registrations } from "@/lib/db/schema";

/**
 * Whether a Member may see another Member's Telegram profile photo.
 *
 * The answer is "they meet somewhere": the viewer holds a Registration in a
 * Chat whose standings the subject appears in. That is exactly the situation
 * the Mini App shows the two of them together in, so it is the whole of the
 * permission — a Display identity is what puts a name on a Leaderboard, and a
 * Registration is what lets someone read one.
 *
 * Scoping the lookup this way rather than per Chat keeps the photo endpoint
 * addressable by Member alone, so a face fetched for one Leaderboard is already
 * cached for the next.
 */
export async function sharesChatWithMember(
  db: AppDatabase,
  viewerId: number,
  subjectId: number,
): Promise<boolean> {
  const rows = await db
    .select({ chatId: registrations.chatId })
    .from(registrations)
    .innerJoin(
      displayIdentities,
      and(
        eq(displayIdentities.chatId, registrations.chatId),
        eq(displayIdentities.userId, subjectId),
      ),
    )
    .where(eq(registrations.userId, viewerId))
    .limit(1);

  return rows.length === 1;
}
