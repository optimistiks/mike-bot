import type { AppDatabase } from "@/lib/db/runtime";
import { chatMembers, events } from "@/lib/db/schema";

import { convertV1Row, type V1LolRow } from "./v1-row";

export interface ImportV1Stats {
  rowsProcessed: number;
  eventsInserted: number;
  eventsSkipped: number;
  membersUpserted: number;
}

async function upsertImportedMember(
  db: AppDatabase,
  member: { chatId: number; userId: number; displayName: string },
): Promise<void> {
  await db
    .insert(chatMembers)
    .values(member)
    .onConflictDoUpdate({
      target: [chatMembers.chatId, chatMembers.userId],
      set: { displayName: member.displayName },
    });
}

export async function importV1Rows(
  db: AppDatabase,
  rows: V1LolRow[],
): Promise<ImportV1Stats> {
  let eventsInserted = 0;
  let eventsSkipped = 0;
  let membersUpserted = 0;

  for (const row of rows) {
    const { event, members } = convertV1Row(row);

    for (const member of members) {
      await upsertImportedMember(db, member);
      membersUpserted += 1;
    }

    const inserted = await db
      .insert(events)
      .values(event)
      .onConflictDoNothing()
      .returning();

    if (inserted.length > 0) {
      eventsInserted += 1;
    } else {
      eventsSkipped += 1;
    }
  }

  return {
    rowsProcessed: rows.length,
    eventsInserted,
    eventsSkipped,
    membersUpserted,
  };
}
