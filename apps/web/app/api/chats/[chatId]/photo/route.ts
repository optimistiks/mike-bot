import {
  resolveChatMetadata,
  type ChatMetadata,
} from "@/lib/bot/chat-metadata";
import { fetchTelegramFileBytes } from "@/lib/bot/telegram-photo.server";
import { getRuntimeDb } from "@/lib/db/runtime";
import { requireChatAccess } from "@/lib/mini-app/request-access.server";

function photoBytes(metadata: ChatMetadata | null) {
  return metadata?.photoSmallFileId
    ? fetchTelegramFileBytes(metadata.photoSmallFileId)
    : null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ chatId: string }> },
): Promise<Response> {
  const { chatId: rawChatId } = await context.params;

  const refusal = await requireChatAccess(request, rawChatId);
  if (refusal) return refusal;

  const chatId = Number(rawChatId);

  const db = await getRuntimeDb();
  const botToken = process.env.BOT_TOKEN?.trim();
  if (!botToken) {
    return Response.json({ error: "Photo unavailable" }, { status: 404 });
  }

  let metadata = await resolveChatMetadata(db, chatId, botToken);
  let photo = await photoBytes(metadata);

  // A stored file reference outlives the photo it named. One forced refresh
  // distinguishes "the Chat changed its photo" from "the Chat has none".
  if (!photo) {
    metadata = await resolveChatMetadata(db, chatId, botToken, { force: true });
    photo = await photoBytes(metadata);
  }

  if (!photo) {
    return Response.json({ error: "Photo not found" }, { status: 404 });
  }

  return new Response(photo.bytes, {
    headers: {
      "Cache-Control": "private, max-age=3600",
      "Content-Type": photo.contentType,
    },
  });
}
