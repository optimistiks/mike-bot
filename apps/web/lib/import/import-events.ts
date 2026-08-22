import { and, eq } from "drizzle-orm";

import type { AppDatabase } from "@/lib/db/runtime";
import { displayIdentities, events, messageAuthors } from "@/lib/db/schema";

import { convertV1Row, type V1LolRow } from "./v1-row";

export interface ReconciliationCounts {
  inserted: number;
  updated: number;
  unchanged: number;
  skipped: number;
}

export interface ImportV1Stats {
  rowsProcessed: number;
  events: ReconciliationCounts;
  messages: ReconciliationCounts;
  displayIdentities: ReconciliationCounts;
}

interface ImportedDisplayIdentityCandidate {
  chatId: number;
  userId: number;
  displayName: string;
  createdAt: number;
}

interface ImportedMessageCandidate {
  chatId: number;
  messageId: number;
  authorIds: Set<number>;
  messageDate: number;
}

function emptyCounts(): ReconciliationCounts {
  return { inserted: 0, updated: 0, unchanged: 0, skipped: 0 };
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

function messageCandidates(rows: V1LolRow[]): ImportedMessageCandidate[] {
  const candidates = new Map<string, ImportedMessageCandidate>();

  for (const row of rows) {
    const key = `${String(row.chatId)}:${String(row.toMessageId)}`;
    const existing = candidates.get(key);
    if (existing) {
      existing.authorIds.add(row.toUser.id);
      existing.messageDate = Math.min(
        existing.messageDate,
        Math.floor(row.createdAt / 1_000),
      );
    } else {
      candidates.set(key, {
        chatId: row.chatId,
        messageId: row.toMessageId,
        authorIds: new Set([row.toUser.id]),
        messageDate: Math.floor(row.createdAt / 1_000),
      });
    }
  }

  return [...candidates.values()];
}

async function reconcileIdentities(
  db: AppDatabase,
  rows: V1LolRow[],
  counts: ReconciliationCounts,
): Promise<void> {
  for (const candidate of latestDisplayIdentities(rows)) {
    const existing = await db
      .select()
      .from(displayIdentities)
      .where(
        and(
          eq(displayIdentities.chatId, candidate.chatId),
          eq(displayIdentities.userId, candidate.userId),
        ),
      )
      .limit(1);
    const current = existing.at(0);

    if (!current) {
      await db.insert(displayIdentities).values({
        chatId: candidate.chatId,
        userId: candidate.userId,
        displayName: candidate.displayName,
      });
      counts.inserted += 1;
    } else if (current.displayName !== candidate.displayName) {
      await db
        .update(displayIdentities)
        .set({ displayName: candidate.displayName })
        .where(
          and(
            eq(displayIdentities.chatId, candidate.chatId),
            eq(displayIdentities.userId, candidate.userId),
          ),
        );
      counts.updated += 1;
    } else {
      counts.unchanged += 1;
    }
  }
}

async function reconcileMessages(
  db: AppDatabase,
  rows: V1LolRow[],
  counts: ReconciliationCounts,
): Promise<void> {
  for (const candidate of messageCandidates(rows)) {
    if (candidate.authorIds.size !== 1) {
      console.warn("Skipping v1 Message with conflicting source authors", {
        chatId: candidate.chatId,
        messageId: candidate.messageId,
        authorIds: [...candidate.authorIds],
      });
      counts.skipped += 1;
      continue;
    }

    const authorId = [...candidate.authorIds].at(0);
    if (authorId === undefined) {
      counts.skipped += 1;
      continue;
    }

    const existing = await db
      .select()
      .from(messageAuthors)
      .where(
        and(
          eq(messageAuthors.chatId, candidate.chatId),
          eq(messageAuthors.messageId, candidate.messageId),
        ),
      )
      .limit(1);
    const current = existing.at(0);

    if (!current) {
      await db.insert(messageAuthors).values({
        chatId: candidate.chatId,
        messageId: candidate.messageId,
        authorId,
        authorIsBot: false,
        messageDate: candidate.messageDate,
      });
      counts.inserted += 1;
      continue;
    }

    if (current.authorId !== authorId) {
      console.warn("Skipping v1 Message with conflicting stored author", {
        chatId: candidate.chatId,
        messageId: candidate.messageId,
        sourceAuthorId: authorId,
        storedAuthorId: current.authorId,
      });
      counts.skipped += 1;
      continue;
    }

    const messageDate = Math.min(current.messageDate, candidate.messageDate);
    if (current.authorIsBot || current.messageDate !== messageDate) {
      await db
        .update(messageAuthors)
        .set({ authorIsBot: false, messageDate })
        .where(
          and(
            eq(messageAuthors.chatId, candidate.chatId),
            eq(messageAuthors.messageId, candidate.messageId),
          ),
        );
      counts.updated += 1;
    } else {
      counts.unchanged += 1;
    }
  }
}

async function reconcileEvents(
  db: AppDatabase,
  rows: V1LolRow[],
  counts: ReconciliationCounts,
): Promise<void> {
  for (const row of rows) {
    const { event } = convertV1Row(row);
    const existing = await db
      .select()
      .from(events)
      .where(eq(events.legacyId, event.legacyId))
      .limit(1);
    const current = existing.at(0);

    if (!current) {
      await db.insert(events).values(event);
      counts.inserted += 1;
      continue;
    }

    const unchanged =
      current.type === event.type &&
      current.chatId === event.chatId &&
      current.actorId === event.actorId &&
      current.subjectId === event.subjectId &&
      current.messageId === event.messageId &&
      current.createdAt.getTime() === event.createdAt.getTime() &&
      !current.reversible &&
      current.reversesEventId === null;
    if (unchanged) {
      counts.unchanged += 1;
      continue;
    }

    await db.update(events).set(event).where(eq(events.id, current.id));
    counts.updated += 1;
  }
}

/** Add or reconcile v1 source rows without deleting destination data. */
export async function importV1Rows(
  db: AppDatabase,
  rows: V1LolRow[],
): Promise<ImportV1Stats> {
  const stats: ImportV1Stats = {
    rowsProcessed: rows.length,
    events: emptyCounts(),
    messages: emptyCounts(),
    displayIdentities: emptyCounts(),
  };

  await db.transaction(async (transaction) => {
    const transactionDb = transaction as unknown as AppDatabase;
    await reconcileIdentities(transactionDb, rows, stats.displayIdentities);
    await reconcileMessages(transactionDb, rows, stats.messages);
    await reconcileEvents(transactionDb, rows, stats.events);
  });

  return stats;
}
