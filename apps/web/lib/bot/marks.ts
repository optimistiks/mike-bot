import { and, eq, gte, isNotNull, isNull, lte, or } from "drizzle-orm";

import type { AppDatabase } from "@/lib/db/runtime";
import { marks } from "@/lib/db/schema";
import { type MarkSource, type MarkType } from "@/lib/domain/mark";
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
  /** The Telegram update carrying this Scoring action, which orders it. */
  updateId: number;
}

export interface ApplyMarkChangesResult {
  /** Grants spent by this call. */
  added: number;
  /**
   * Removals this call recorded: a Mark taken back inside the Undo window, or a
   * tombstone left where there was nothing to take back, which holds the slot
   * against an addition still to be handled.
   */
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

/** The Mark's primary key: at most one Mark per Chat, Actor, Message, and slot. */
const MARK_SLOT = [
  marks.chatId,
  marks.actorId,
  marks.messageId,
  marks.slot,
] as const;

/**
 * Spend the grant. The primary key refuses a slot that is already held, so no
 * read is needed. A slot holding a tombstone is free again, but only for an
 * addition that is not older than the removal that left it — that is what makes
 * an addition handled after its own removal lose rather than resurrect the Mark.
 */
async function addMark(
  db: AppDatabase,
  input: ApplyMarkChangesInput,
  type: MarkType,
): Promise<number> {
  const values = {
    ...input.identity,
    type,
    createdAt: input.createdAt,
    source: input.source,
    updateId: input.updateId,
  };

  const inserted = await db
    .insert(marks)
    .values(values)
    .onConflictDoUpdate({
      target: [...MARK_SLOT],
      set: { ...values, undoneAt: null },
      setWhere: and(
        isNotNull(marks.undoneAt),
        lte(marks.updateId, input.updateId),
      ),
    })
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
  // Telegram timestamps are whole seconds and the bound is inclusive, so the
  // window a Member actually gets is five to six seconds of wall clock.
  const undoableAfter = new Date(
    input.createdAt.getTime() - MARK_UNDO_WINDOW_MS,
  );

  // Writing a tombstone rather than deleting the row is what orders this removal
  // against its own addition: an upsert waits for a conflicting uncommitted
  // insert, where a delete would simply not see it.
  const touched = await db
    .insert(marks)
    .values({
      ...input.identity,
      type,
      createdAt: input.createdAt,
      source: "reaction",
      updateId: input.updateId,
      undoneAt: input.createdAt,
    })
    .onConflictDoUpdate({
      target: [...MARK_SLOT],
      set: { undoneAt: input.createdAt, updateId: input.updateId },
      setWhere: and(
        isNull(marks.undoneAt),
        eq(marks.source, "reaction"),
        gte(marks.createdAt, undoableAfter),
        // Marks predating `update_id` are long past their Undo window; treat a
        // missing id as "older than anything" rather than refusing the removal.
        or(isNull(marks.updateId), lte(marks.updateId, input.updateId)),
      ),
    })
    .returning();

  return touched.length;
}
