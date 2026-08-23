import { and, eq, gte } from "drizzle-orm";

import type { AppDatabase } from "@/lib/db/runtime";
import { marks } from "@/lib/db/schema";
import {
  markSlotForType,
  type MarkSource,
  type MarkType,
} from "@/lib/domain/mark";
import { MARK_UNDO_WINDOW_MS } from "@/lib/scoring";

export interface MarkIdentity {
  chatId: number;
  actorId: number;
  subjectId: number;
  messageId: number;
}

export interface MarkChange {
  action: "add" | "remove";
  type: MarkType;
}

export interface ApplyMarkChangesInput {
  identity: MarkIdentity;
  changes: readonly MarkChange[];
  createdAt: Date;
  source: MarkSource;
}

export interface ApplyMarkChangesResult {
  /** Grants spent by this call. */
  added: number;
  /** Marks taken back inside the Undo window by this call. */
  undone: number;
  /** Changes that did nothing: the grant was already spent, or already gone. */
  refused: number;
}

/**
 * Apply a removal-before-addition Mark transition.
 *
 * Both directions are single statements. Adding relies on the `marks` primary
 * key to refuse a slot that is already spent, so no read and no row lock is
 * needed; removing matches the Undo window against Telegram's own timestamps.
 */
export async function applyMarkChanges(
  db: AppDatabase,
  input: ApplyMarkChangesInput,
): Promise<ApplyMarkChangesResult> {
  let added = 0;
  let undone = 0;
  let refused = 0;

  for (const change of input.changes) {
    const affected =
      change.action === "add"
        ? await addMark(db, input, change.type)
        : await undoMark(db, input, change.type);

    if (affected === 0) {
      refused += 1;
    } else if (change.action === "add") {
      added += affected;
    } else {
      undone += affected;
    }
  }

  return { added, undone, refused };
}

async function addMark(
  db: AppDatabase,
  input: ApplyMarkChangesInput,
  type: MarkType,
): Promise<number> {
  const inserted = await db
    .insert(marks)
    .values({
      ...input.identity,
      type,
      createdAt: input.createdAt,
      source: input.source,
    })
    .onConflictDoNothing()
    .returning();

  return inserted.length;
}

/**
 * Take back a Mark the Actor placed by reaction moments ago. The `source` guard
 * is what stops removing a refused 👎 reaction from deleting the `-` Scoring
 * reply that already occupies the karma slot.
 */
async function undoMark(
  db: AppDatabase,
  input: ApplyMarkChangesInput,
  type: MarkType,
): Promise<number> {
  const undoableAfter = new Date(
    input.createdAt.getTime() - MARK_UNDO_WINDOW_MS,
  );

  const deleted = await db
    .delete(marks)
    .where(
      and(
        eq(marks.chatId, input.identity.chatId),
        eq(marks.actorId, input.identity.actorId),
        eq(marks.messageId, input.identity.messageId),
        eq(marks.slot, markSlotForType(type)),
        eq(marks.type, type),
        eq(marks.source, "reaction"),
        gte(marks.createdAt, undoableAfter),
      ),
    )
    .returning();

  return deleted.length;
}
