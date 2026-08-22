import { eq } from "drizzle-orm";
import { Api } from "grammy";
import type { Chat, ChatFullInfo, PhotoSize } from "grammy/types";

import type { AppDatabase } from "@/lib/db/runtime";
import { chats } from "@/lib/db/schema";

import { isGroupChat } from "./chat";

const METADATA_MAX_AGE_MS = 24 * 60 * 60 * 1_000;

export interface ChatMetadata {
  chatId: number;
  title: string;
  photoSmallFileId: string | null;
  photoUniqueId: string | null;
  metadataCheckedAt: Date | null;
}

function photoFields(photo: PhotoSize | undefined): {
  photoSmallFileId: string | null;
  photoUniqueId: string | null;
} {
  return {
    photoSmallFileId: photo?.file_id ?? null,
    photoUniqueId: photo?.file_unique_id ?? null,
  };
}

export async function upsertChatFromTelegramUpdate(
  db: AppDatabase,
  chat: Chat,
  options: {
    newTitle?: string;
    newPhoto?: PhotoSize[];
    deletePhoto?: boolean;
  } = {},
): Promise<void> {
  if (!isGroupChat(chat.type)) return;

  const title = options.newTitle ?? ("title" in chat ? chat.title : undefined);
  if (!title) return;
  const photo =
    options.newPhoto === undefined
      ? undefined
      : photoFields(options.newPhoto.at(0));

  const insertValues = {
    chatId: chat.id,
    title,
    photoSmallFileId: photo?.photoSmallFileId ?? null,
    photoUniqueId: photo?.photoUniqueId ?? null,
  };
  const updateValues =
    photo || options.deletePhoto
      ? {
          title,
          photoSmallFileId: photo?.photoSmallFileId ?? null,
          photoUniqueId: photo?.photoUniqueId ?? null,
        }
      : { title };

  await db.insert(chats).values(insertValues).onConflictDoUpdate({
    target: chats.chatId,
    set: updateValues,
  });
}

export async function storeChatFullInfo(
  db: AppDatabase,
  chat: ChatFullInfo,
  checkedAt = new Date(),
): Promise<ChatMetadata | null> {
  if (!isGroupChat(chat.type)) return null;

  const title = "title" in chat ? chat.title : undefined;
  if (!title) return null;

  const metadata: ChatMetadata = {
    chatId: chat.id,
    title,
    photoSmallFileId: chat.photo?.small_file_id ?? null,
    photoUniqueId: chat.photo?.small_file_unique_id ?? null,
    metadataCheckedAt: checkedAt,
  };

  await db
    .insert(chats)
    .values(metadata)
    .onConflictDoUpdate({
      target: chats.chatId,
      set: {
        title: metadata.title,
        photoSmallFileId: metadata.photoSmallFileId,
        photoUniqueId: metadata.photoUniqueId,
        metadataCheckedAt: metadata.metadataCheckedAt,
      },
    });

  return metadata;
}

export async function getStoredChatMetadata(
  db: AppDatabase,
  chatId: number,
): Promise<ChatMetadata | null> {
  const rows = await db
    .select()
    .from(chats)
    .where(eq(chats.chatId, chatId))
    .limit(1);
  return rows.at(0) ?? null;
}

export async function refreshChatMetadata(
  db: AppDatabase,
  chatId: number,
  botToken: string,
): Promise<ChatMetadata | null> {
  const telegramChat = await new Api(botToken).getChat(chatId);
  return storeChatFullInfo(db, telegramChat);
}

export async function resolveChatMetadata(
  db: AppDatabase,
  chatId: number,
  botToken: string,
  options: { force?: boolean; now?: Date } = {},
): Promise<ChatMetadata | null> {
  const stored = await getStoredChatMetadata(db, chatId);
  const now = options.now ?? new Date();
  const checkedAt = stored?.metadataCheckedAt?.getTime();
  const isFresh =
    stored !== null &&
    checkedAt !== undefined &&
    now.getTime() - checkedAt < METADATA_MAX_AGE_MS;

  if (
    !options.force &&
    stored &&
    (isFresh || process.env.NODE_ENV === "test")
  ) {
    return stored;
  }

  try {
    return await refreshChatMetadata(db, chatId, botToken);
  } catch {
    return stored;
  }
}
