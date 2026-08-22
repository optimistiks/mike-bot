import { and, eq, isNull, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { AppDatabase } from "@/lib/db/runtime";
import { events, messageAuthors } from "@/lib/db/schema";
import type { EventType } from "@/lib/domain/event";

export interface MarkIdentity {
  chatId: number;
  actorId: number;
  subjectId: number;
  messageId: number;
  type: EventType;
}

export interface MarkChange {
  action: "add" | "remove";
  type: EventType;
}

export interface ApplyMarkChangesInput {
  identity: Omit<MarkIdentity, "type">;
  changes: readonly MarkChange[];
  createdAt: Date;
  additionsAreReversible: boolean;
}

export interface ApplyMarkChangesResult {
  additions: number;
  reversals: number;
}

async function lockMessage(
  db: AppDatabase,
  chatId: number,
  messageId: number,
): Promise<void> {
  await db.execute(sql`
    select 1
    from ${messageAuthors}
    where ${messageAuthors.chatId} = ${chatId}
      and ${messageAuthors.messageId} = ${messageId}
    for update
  `);
}

async function findActiveAddition(db: AppDatabase, identity: MarkIdentity) {
  const reversals = alias(events, "mark_reversals");
  const rows = await db
    .select({
      id: events.id,
      subjectId: events.subjectId,
      reversible: events.reversible,
    })
    .from(events)
    .where(
      and(
        eq(events.chatId, identity.chatId),
        eq(events.actorId, identity.actorId),
        eq(events.messageId, identity.messageId),
        eq(events.type, identity.type),
        isNull(events.reversesEventId),
        notExists(
          db
            .select({ id: reversals.id })
            .from(reversals)
            .where(eq(reversals.reversesEventId, events.id)),
        ),
      ),
    )
    .orderBy(events.id)
    .limit(1);

  return rows.at(0);
}

/**
 * Apply a removal-before-addition Mark transition while holding the Message
 * lock. This is the sole active-Mark uniqueness boundary for live inputs.
 */
export async function applyMarkChanges(
  db: AppDatabase,
  input: ApplyMarkChangesInput,
): Promise<ApplyMarkChangesResult> {
  await lockMessage(db, input.identity.chatId, input.identity.messageId);

  let additions = 0;
  let reversals = 0;

  for (const change of input.changes) {
    const identity = { ...input.identity, type: change.type };
    const active = await findActiveAddition(db, identity);

    if (change.action === "add") {
      if (active) continue;

      await db.insert(events).values({
        ...identity,
        createdAt: input.createdAt,
        reversible: input.additionsAreReversible,
      });
      additions += 1;
      continue;
    }

    if (!active?.reversible) continue;

    await db.insert(events).values({
      ...identity,
      subjectId: active.subjectId,
      createdAt: input.createdAt,
      reversible: false,
      reversesEventId: active.id,
    });
    reversals += 1;
  }

  return { additions, reversals };
}
