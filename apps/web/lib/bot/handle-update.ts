import { and, eq } from "drizzle-orm";
import type { Update } from "grammy/types";

import type { AppDatabase } from "@/lib/db/runtime";
import { addChatMembership, removeChatMembership } from "@/lib/db/memberships";
import {
  chatMembers,
  events,
  messageAuthors,
  processedUpdates,
} from "@/lib/db/schema";
import { isActiveChatMemberStatus } from "@/lib/mini-app/membership-status";

import { memberDisplayName } from "./display-name";
import { isRegistrationMessage } from "./register";
import {
  diffReactionStates,
  reactionDiffToEventTypes,
} from "./reaction-events";

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

async function upsertMessageAuthor(
  db: AppDatabase,
  row: {
    chatId: number;
    messageId: number;
    authorId: number;
    authorIsBot: boolean;
    messageDate: number;
  },
): Promise<void> {
  await db.insert(messageAuthors).values(row).onConflictDoNothing();
}

async function upsertChatMember(
  db: AppDatabase,
  chatId: number,
  user: { id: number; username?: string; first_name: string },
): Promise<void> {
  await db
    .insert(chatMembers)
    .values({
      chatId,
      userId: user.id,
      displayName: memberDisplayName(user),
    })
    .onConflictDoUpdate({
      target: [chatMembers.chatId, chatMembers.userId],
      set: { displayName: memberDisplayName(user) },
    });
}

async function handleMessageUpdate(
  db: AppDatabase,
  message: NonNullable<Update["message"]>,
): Promise<void> {
  const chatId = message.chat.id;
  const messageId = message.message_id;
  const from = message.from;

  await upsertMessageAuthor(db, {
    chatId,
    messageId,
    authorId: from.id,
    authorIsBot: from.is_bot,
    messageDate: message.date,
  });

  await upsertChatMember(db, chatId, from);
}

async function handleChatMemberUpdate(
  db: AppDatabase,
  update: NonNullable<Update["chat_member"]>,
): Promise<void> {
  const chatId = update.chat.id;
  const member = update.new_chat_member;
  const userId = member.user.id;

  await upsertChatMember(db, chatId, member.user);

  if (isActiveChatMemberStatus(member.status)) {
    return;
  }

  await removeChatMembership(db, chatId, userId);
}

async function handleMessageReactionUpdate(
  db: AppDatabase,
  reaction: NonNullable<Update["message_reaction"]>,
): Promise<void> {
  const actor = reaction.user;
  if (!actor || actor.is_bot) {
    return;
  }

  const chatId = reaction.chat.id;
  const messageId = reaction.message_id;

  const cached = await db
    .select()
    .from(messageAuthors)
    .where(
      and(
        eq(messageAuthors.chatId, chatId),
        eq(messageAuthors.messageId, messageId),
      ),
    )
    .limit(1);

  const author = cached.at(0);
  if (author === undefined) {
    console.log("skip uncached message", {
      chat_id: chatId,
      message_id: messageId,
      actor_id: actor.id,
    });
    return;
  }

  const changes = diffReactionStates(
    reaction.old_reaction,
    reaction.new_reaction,
  );

  if (author.authorIsBot) {
    const isRegistration = await isRegistrationMessage(db, chatId, messageId);
    if (!isRegistration || changes.addedReactions.length === 0) {
      return;
    }

    await upsertChatMember(db, chatId, actor);
    await addChatMembership(db, chatId, actor.id);
    return;
  }

  const mapped = reactionDiffToEventTypes({
    ...changes,
    actorId: actor.id,
    subjectId: author.authorId,
    subjectIsBot: author.authorIsBot,
  });

  if (!mapped.ok || mapped.eventTypes.length === 0) {
    return;
  }

  const createdAt = new Date(reaction.date * 1000);

  await upsertChatMember(db, chatId, actor);

  await db.insert(events).values(
    mapped.eventTypes.map((type) => ({
      type,
      chatId,
      actorId: actor.id,
      subjectId: author.authorId,
      messageId,
      createdAt,
    })),
  );
}

/** Process one Telegram update atomically and report whether this call claimed it. */
export async function handleTelegramUpdate(
  db: AppDatabase,
  update: Update,
  onClaimedUpdate?: (db: AppDatabase) => Promise<void>,
): Promise<boolean> {
  return db.transaction(async (transaction) => {
    const transactionDb = transaction as unknown as AppDatabase;
    const isNew = await tryClaimUpdate(transactionDb, update.update_id);
    if (!isNew) {
      return false;
    }

    if (update.message) {
      await handleMessageUpdate(transactionDb, update.message);
    }

    if (update.chat_member) {
      await handleChatMemberUpdate(transactionDb, update.chat_member);
    }

    if (update.message_reaction) {
      await handleMessageReactionUpdate(transactionDb, update.message_reaction);
    }

    await onClaimedUpdate?.(transactionDb);
    return true;
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
