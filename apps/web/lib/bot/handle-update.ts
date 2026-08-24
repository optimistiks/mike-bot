import { and, eq } from "drizzle-orm";
import type { Update } from "grammy/types";

import { removeRegistration } from "@/lib/db/registrations";
import type { AppDatabase } from "@/lib/db/runtime";
import {
  displayIdentities,
  messageAuthors,
  processedUpdates,
} from "@/lib/db/schema";
import { isActiveChatMemberStatus } from "@/lib/mini-app/membership-status";
import { isSeasonOpenForAction } from "@/lib/scoring";

import { upsertChatFromTelegramUpdate } from "./chat-metadata";
import { memberDisplayName } from "./display-name";
import { applyMarkChanges } from "./marks";
import { replyTextToMarkType } from "./reply-marks";
import {
  diffReactionStates,
  reactionDiffToMarkChanges,
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

async function upsertDisplayIdentity(
  db: AppDatabase,
  chatId: number,
  user: { id: number; username?: string; first_name: string },
): Promise<void> {
  await db
    .insert(displayIdentities)
    .values({
      chatId,
      userId: user.id,
      displayName: memberDisplayName(user),
    })
    .onConflictDoUpdate({
      target: [displayIdentities.chatId, displayIdentities.userId],
      set: { displayName: memberDisplayName(user) },
    });
}

/**
 * The Members a message tells us about: its sender, and the author of whatever
 * it replies to.
 *
 * Sorted by user id and deduplicated so that two updates touching the same pair
 * — Alice replying to Bob while Bob replies to Alice — take the identity rows
 * in the same order and cannot deadlock against each other.
 */
export interface DisplayIdentityMember {
  id: number;
  is_bot: boolean;
  username?: string;
  first_name: string;
}

export function messageDisplayIdentities(message: {
  from?: DisplayIdentityMember;
  reply_to_message?: { from?: DisplayIdentityMember };
}): DisplayIdentityMember[] {
  const members = new Map<number, DisplayIdentityMember>();

  for (const candidate of [message.from, message.reply_to_message?.from]) {
    if (candidate && !candidate.is_bot) {
      members.set(candidate.id, candidate);
    }
  }

  return [...members.values()].sort((left, right) => left.id - right.id);
}

async function handleMessageUpdate(
  db: AppDatabase,
  message: NonNullable<Update["message"]>,
): Promise<void> {
  if (message.chat.type !== "supergroup") {
    return;
  }

  const chatId = message.chat.id;
  const messageId = message.message_id;
  const from = message.from;

  await upsertChatFromTelegramUpdate(db, message.chat, {
    newTitle: message.new_chat_title,
    newPhoto: message.new_chat_photo,
    deletePhoto: message.delete_chat_photo,
  });

  // Ephemeral messages carry message_id 0 and cannot be reacted to, so caching
  // them would only write a junk (chat_id, 0) row. A Scoring reply is about to
  // be deleted and replaced by the bot's own answer, so it is not a Message
  // anyone should be able to mark either — reacting to a bare "+" would spend a
  // grant on its author for typing it.
  const isScoringReply =
    message.reply_to_message !== undefined &&
    message.text !== undefined &&
    replyTextToMarkType(message.text) !== null;

  if (message.ephemeral_message_id === undefined && !isScoringReply) {
    await upsertMessageAuthor(db, {
      chatId,
      messageId,
      authorId: from.id,
      authorIsBot: from.is_bot,
      messageDate: message.date,
    });
  }

  const repliedTo = message.reply_to_message;
  if (repliedTo?.from) {
    await upsertMessageAuthor(db, {
      chatId,
      messageId: repliedTo.message_id,
      authorId: repliedTo.from.id,
      authorIsBot: repliedTo.from.is_bot,
      messageDate: repliedTo.date,
    });
  }

  for (const member of messageDisplayIdentities(message)) {
    await upsertDisplayIdentity(db, chatId, member);
  }
}

async function handleChatMemberUpdate(
  db: AppDatabase,
  update: NonNullable<Update["chat_member"]>,
): Promise<void> {
  if (update.chat.type !== "supergroup") {
    return;
  }

  const chatId = update.chat.id;
  await upsertChatFromTelegramUpdate(db, update.chat);
  const member = update.new_chat_member;
  const userId = member.user.id;

  if (!member.user.is_bot) {
    await upsertDisplayIdentity(db, chatId, member.user);
  }

  if (isActiveChatMemberStatus(member.status)) {
    return;
  }

  await removeRegistration(db, chatId, userId);
}

async function handleMessageReactionUpdate(
  db: AppDatabase,
  reaction: NonNullable<Update["message_reaction"]>,
  updateId: number,
): Promise<void> {
  if (reaction.chat.type !== "supergroup") {
    return;
  }

  const actor = reaction.user;
  if (!actor || actor.is_bot) {
    return;
  }

  const chatId = reaction.chat.id;
  await upsertChatFromTelegramUpdate(db, reaction.chat);
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

  // Bot-authored messages are never Subjects, so reactions on them score nothing.
  if (author.authorIsBot) {
    return;
  }

  const mapped = reactionDiffToMarkChanges({
    ...changes,
    actorId: actor.id,
    subjectId: author.authorId,
    subjectIsBot: author.authorIsBot,
  });

  if (!mapped.ok || mapped.changes.length === 0) {
    return;
  }

  const createdAt = new Date(reaction.date * 1000);
  if (Number.isNaN(createdAt.getTime())) {
    // No retry can succeed on a timestamp the bot cannot read, and throwing
    // would ask Telegram to redeliver this update until it gives up.
    console.log("skip reaction with an unreadable date", {
      chat_id: chatId,
      message_id: messageId,
      actor_id: actor.id,
      date: reaction.date,
    });
    return;
  }

  const messageDate = new Date(author.messageDate * 1000);
  if (!isSeasonOpenForAction(messageDate, createdAt)) {
    return;
  }

  await upsertDisplayIdentity(db, chatId, actor);

  await applyMarkChanges(db, {
    identity: {
      chatId,
      actorId: actor.id,
      subjectId: author.authorId,
      messageId,
    },
    changes: mapped.changes,
    createdAt,
    source: "reaction",
    updateId,
  });
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
      await handleMessageReactionUpdate(
        transactionDb,
        update.message_reaction,
        update.update_id,
      );
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
