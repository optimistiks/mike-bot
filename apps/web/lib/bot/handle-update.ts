import { and, eq } from "drizzle-orm";

import type { Update } from "grammy/types";

import { addRegistration, removeRegistration } from "@/lib/db/registrations";
import type { AppDatabase } from "@/lib/db/runtime";
import {
  displayIdentities,
  messageAuthors,
  processedUpdates,
} from "@/lib/db/schema";

import { upsertChatFromTelegramUpdate } from "./chat-metadata";
import { applyMarkChanges } from "./marks";
import {
  readUpdate,
  reactionMessageRef,
  type Announcement,
  type CachedMessage,
  type ChatFacts,
  type IdentityToTouch,
  type MessageToCache,
} from "./read-update";

export interface HandledUpdate {
  /** Whether this call claimed the update, rather than losing to a redelivery. */
  claimed: boolean;
  /** What to say in the Chat, once the transaction has committed. */
  announcement: Announcement | null;
}

async function tryClaimUpdate(
  db: AppDatabase,
  updateId: number,
): Promise<boolean> {
  const inserted = await db
    .insert(processedUpdates)
    .values({ updateId })
    .onConflictDoNothing()
    .returning();

  return inserted.length === 1;
}

async function findCachedMessage(
  db: AppDatabase,
  chatId: number,
  messageId: number,
): Promise<CachedMessage | null> {
  const rows = await db
    .select()
    .from(messageAuthors)
    .where(
      and(
        eq(messageAuthors.chatId, chatId),
        eq(messageAuthors.messageId, messageId),
      ),
    )
    .limit(1);

  return rows.at(0) ?? null;
}

async function cacheMessage(
  db: AppDatabase,
  message: MessageToCache,
): Promise<void> {
  await db.insert(messageAuthors).values(message).onConflictDoNothing();
}

async function touchIdentity(
  db: AppDatabase,
  identity: IdentityToTouch,
): Promise<void> {
  await db
    .insert(displayIdentities)
    .values(identity)
    .onConflictDoUpdate({
      target: [displayIdentities.chatId, displayIdentities.userId],
      set: { displayName: identity.displayName },
    });
}

/**
 * Write the facts one update implies, in order, deciding nothing.
 *
 * The single contingent step is the acknowledgement: a Scoring reply is
 * answered only when it actually spent a grant, and only the write knows that.
 */
async function applyFacts(
  db: AppDatabase,
  facts: ChatFacts,
): Promise<Announcement | null> {
  if (facts.skipped) {
    console.log(facts.skipped.reason, facts.skipped.detail);
  }

  if (facts.metadata) {
    await upsertChatFromTelegramUpdate(db, facts.metadata.chat, {
      newTitle: facts.metadata.newTitle,
      newPhoto: facts.metadata.newPhoto,
      deletePhoto: facts.metadata.deletePhoto,
    });
  }

  for (const message of facts.messages) {
    await cacheMessage(db, message);
  }

  for (const identity of facts.identities) {
    await touchIdentity(db, identity);
  }

  if (facts.addRegistration) {
    await addRegistration(
      db,
      facts.addRegistration.chatId,
      facts.addRegistration.userId,
    );
  }

  if (facts.removeRegistration) {
    await removeRegistration(
      db,
      facts.removeRegistration.chatId,
      facts.removeRegistration.userId,
    );
  }

  if (!facts.markChanges) {
    return facts.announcement;
  }

  const result = await applyMarkChanges(db, facts.markChanges);

  return result.added === 1 && facts.acknowledgement
    ? facts.acknowledgement
    : facts.announcement;
}

/** Process one Telegram update atomically and report what it claimed and owes. */
export async function handleTelegramUpdate(
  db: AppDatabase,
  update: Update,
  botUsername: string,
): Promise<HandledUpdate> {
  return db.transaction(async (transaction) => {
    const transactionDb = transaction as unknown as AppDatabase;

    if (!(await tryClaimUpdate(transactionDb, update.update_id))) {
      return { claimed: false, announcement: null };
    }

    // The one lookup reading needs. Hoisting it here is what keeps `readUpdate`
    // a total function of the update and the Chat facts already stored.
    const reference = reactionMessageRef(update);
    const cachedMessage = reference
      ? await findCachedMessage(
          transactionDb,
          reference.chatId,
          reference.messageId,
        )
      : null;

    const announcement = await applyFacts(
      transactionDb,
      readUpdate(update, cachedMessage, botUsername),
    );

    return { claimed: true, announcement };
  });
}

/** Test helper: look up cached author for assertions. */
export async function getMessageAuthor(
  db: AppDatabase,
  chatId: number,
  messageId: number,
) {
  const rows = await db
    .select()
    .from(messageAuthors)
    .where(
      and(
        eq(messageAuthors.chatId, chatId),
        eq(messageAuthors.messageId, messageId),
      ),
    )
    .limit(1);

  return rows[0];
}
