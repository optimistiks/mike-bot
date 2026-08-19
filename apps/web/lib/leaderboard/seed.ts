import { eq } from "drizzle-orm";

import type { AppDatabase } from "@/lib/db/runtime";
import { chatMembers, events } from "@/lib/db/schema";

/** Hardcoded fixture chat for local Mini App and API smoke tests. */
export const FIXTURE_CHAT_ID = -100_456_789;

const FIXTURE_MEMBERS = [
  { userId: 101, displayName: "@alice" },
  { userId: 102, displayName: "@bob" },
  { userId: 103, displayName: "@carol" },
] as const;

const FIXTURE_EVENTS = [
  {
    type: "karma.plus",
    actorId: 101,
    subjectId: 102,
    messageId: 1,
    createdAt: new Date("2026-08-05T12:00:00.000Z"),
  },
  {
    type: "karma.plus",
    actorId: 103,
    subjectId: 102,
    messageId: 2,
    createdAt: new Date("2026-08-06T12:00:00.000Z"),
  },
  {
    type: "karma.minus",
    actorId: 101,
    subjectId: 103,
    messageId: 3,
    createdAt: new Date("2026-08-07T12:00:00.000Z"),
  },
  {
    type: "humor.add",
    actorId: 102,
    subjectId: 103,
    messageId: 4,
    createdAt: new Date("2026-08-08T12:00:00.000Z"),
  },
  {
    type: "humor.add",
    actorId: 101,
    subjectId: 102,
    messageId: 5,
    createdAt: new Date("2026-08-09T12:00:00.000Z"),
  },
] as const;

export async function seedLeaderboardFixture(db: AppDatabase): Promise<void> {
  const existing = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.chatId, FIXTURE_CHAT_ID))
    .limit(1);

  if (existing.length > 0) {
    return;
  }

  await db.insert(chatMembers).values(
    FIXTURE_MEMBERS.map((member) => ({
      chatId: FIXTURE_CHAT_ID,
      userId: member.userId,
      displayName: member.displayName,
    })),
  );

  await db.insert(events).values(
    FIXTURE_EVENTS.map((event) => ({
      chatId: FIXTURE_CHAT_ID,
      ...event,
    })),
  );
}
