import { and, eq } from "drizzle-orm";
import type { Update } from "grammy/types";

import { addRegistration, removeRegistration } from "@/lib/db/registrations";
import type { AppDatabase } from "@/lib/db/runtime";
import {
  displayIdentities,
  messageAuthors,
  processedUpdates,
} from "@/lib/db/schema";
import { isActiveChatMemberStatus } from "@/lib/mini-app/membership-status";
import { creditedSeasonForReaction } from "@/lib/scoring";

import { isGroupChat } from "./chat";
import { upsertChatFromTelegramUpdate } from "./chat-metadata";
import { memberDisplayName } from "./display-name";
import { applyMarkChanges } from "./marks";
import { isRegistrationMessage } from "./register";
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

async function handleMessageUpdate(
  db: AppDatabase,
  message: NonNullable<Update["message"]>,
): Promise<void> {
  if (!isGroupChat(message.chat.type)) {
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

  await upsertMessageAuthor(db, {
    chatId,
    messageId,
    authorId: from.id,
    authorIsBot: from.is_bot,
    messageDate: message.date,
  });

  if (!from.is_bot) {
    await upsertDisplayIdentity(db, chatId, from);
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

    if (!repliedTo.from.is_bot) {
      await upsertDisplayIdentity(db, chatId, repliedTo.from);
    }
  }
}

async function handleChatMemberUpdate(
  db: AppDatabase,
  update: NonNullable<Update["chat_member"]>,
): Promise<void> {
  if (!isGroupChat(update.chat.type)) {
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
): Promise<void> {
  if (!isGroupChat(reaction.chat.type)) {
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

  if (author.authorIsBot) {
    const isRegistration = await isRegistrationMessage(db, chatId, messageId);
    if (!isRegistration || changes.addedReactions.length === 0) {
      return;
    }

    await upsertDisplayIdentity(db, chatId, actor);
    await addRegistration(db, chatId, actor.id);
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
    throw new RangeError("Telegram reaction date is invalid");
  }

  const messageDate = new Date(author.messageDate * 1000);
  if (creditedSeasonForReaction(messageDate, createdAt) === null) {
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
    additionsAreReversible: true,
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
