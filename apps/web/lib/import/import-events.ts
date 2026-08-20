import type { AppDatabase } from "@/lib/db/runtime";
import { chatMembers, events } from "@/lib/db/schema";

import { convertV1Row, type V1LolRow } from "./v1-row";

export interface ImportV1Stats {
  rowsProcessed: number;
  eventsInserted: number;
  eventsSkipped: number;
  membersInserted: number;
}

interface ImportedMemberCandidate {
  chatId: number;
  userId: number;
  displayName: string;
  createdAt: number;
}

function latestImportedMembers(rows: V1LolRow[]): ImportedMemberCandidate[] {
  const candidates = new Map<string, ImportedMemberCandidate>();

  for (const row of rows) {
    const { members } = convertV1Row(row);
    for (const member of members) {
      const key = `${String(member.chatId)}:${String(member.userId)}`;
      const existing = candidates.get(key);
      if (
        !existing ||
        row.createdAt > existing.createdAt ||
        (row.createdAt === existing.createdAt &&
          member.displayName.localeCompare(existing.displayName) > 0)
      ) {
        candidates.set(key, { ...member, createdAt: row.createdAt });
      }
    }
  }

  return [...candidates.values()];
}

export async function importV1Rows(
  db: AppDatabase,
  rows: V1LolRow[],
): Promise<ImportV1Stats> {
  let eventsInserted = 0;
  let eventsSkipped = 0;
  let membersInserted = 0;

  const memberCandidates = latestImportedMembers(rows);
  if (memberCandidates.length > 0) {
    const inserted = await db
      .insert(chatMembers)
      .values(
        memberCandidates.map((member) => ({
          chatId: member.chatId,
          userId: member.userId,
          displayName: member.displayName,
        })),
      )
      .onConflictDoNothing()
      .returning();
    membersInserted = inserted.length;
  }

  for (const row of rows) {
    const { event } = convertV1Row(row);

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
    membersInserted,
  };
}
