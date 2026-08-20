import type { AppDatabase } from "@/lib/db/runtime";
import { displayIdentities, events } from "@/lib/db/schema";

import { convertV1Row, type V1LolRow } from "./v1-row";

export interface ImportV1Stats {
  rowsProcessed: number;
  eventsInserted: number;
  eventsSkipped: number;
  displayIdentitiesInserted: number;
}

interface ImportedDisplayIdentityCandidate {
  chatId: number;
  userId: number;
  displayName: string;
  createdAt: number;
}

function latestDisplayIdentities(
  rows: V1LolRow[],
): ImportedDisplayIdentityCandidate[] {
  const candidates = new Map<string, ImportedDisplayIdentityCandidate>();

  for (const row of rows) {
    const { displayIdentities: identities } = convertV1Row(row);
    for (const identity of identities) {
      const key = `${String(identity.chatId)}:${String(identity.userId)}`;
      const existing = candidates.get(key);
      if (
        !existing ||
        row.createdAt > existing.createdAt ||
        (row.createdAt === existing.createdAt &&
          identity.displayName.localeCompare(existing.displayName) > 0)
      ) {
        candidates.set(key, { ...identity, createdAt: row.createdAt });
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
  let displayIdentitiesInserted = 0;

  const identityCandidates = latestDisplayIdentities(rows);
  if (identityCandidates.length > 0) {
    const inserted = await db
      .insert(displayIdentities)
      .values(
        identityCandidates.map((identity) => ({
          chatId: identity.chatId,
          userId: identity.userId,
          displayName: identity.displayName,
        })),
      )
      .onConflictDoNothing()
      .returning();
    displayIdentitiesInserted = inserted.length;
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
    displayIdentitiesInserted,
  };
}
