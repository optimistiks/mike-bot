import { and, eq } from "drizzle-orm";
import type { Update } from "grammy/types";

import type { AppDatabase } from "@/lib/db/runtime";
import {
  chatMembers,
  events,
  messageAuthors,
  processedUpdates,
} from "@/lib/db/schema";

import { memberDisplayName } from "./display-name";
import { reactionDiffToEventTypes } from "./reaction-events";

function toEmojiList(reactions: { type: string; emoji?: string }[]): string[] {
  const emojis: string[] = [];
  for (const reaction of reactions) {
    if (reaction.type === "emoji" && reaction.emoji) {
      emojis.push(reaction.emoji);
    }
  }
  return emojis;
}

async function tryMarkUpdateProcessed(
  db: AppDatabase,
  updateId: number,
): Promise<boolean> {
  const existing = await db
    .select({ updateId: processedUpdates.updateId })
    .from(processedUpdates)
    .where(eq(processedUpdates.updateId, updateId))
    .limit(1);

  if (existing.length > 0) {
    return false;
  }

  await db.insert(processedUpdates).values({ updateId });
  return true;
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

  const emojiAdded = toEmojiList(reaction.new_reaction);
  const emojiRemoved = toEmojiList(reaction.old_reaction);

  const mapped = reactionDiffToEventTypes({
    emojiAdded,
    emojiRemoved,
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

/** Process one Telegram update (dedup, cache, scoring). Used by webhook and tests. */
export async function handleTelegramUpdate(
  db: AppDatabase,
  update: Update,
): Promise<void> {
  const isNew = await tryMarkUpdateProcessed(db, update.update_id);
  if (!isNew) {
    return;
  }

  if (update.message) {
    await handleMessageUpdate(db, update.message);
  }

  if (update.message_reaction) {
    await handleMessageReactionUpdate(db, update.message_reaction);
  }
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
