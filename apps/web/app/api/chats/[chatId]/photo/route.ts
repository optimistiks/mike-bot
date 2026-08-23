import {
  resolveChatMetadata,
  type ChatMetadata,
} from "@/lib/bot/chat-metadata";
import { fetchTelegramFileBytes } from "@/lib/bot/telegram-photo.server";
import { hasRegistration } from "@/lib/db/registrations";
import { getRuntimeDb } from "@/lib/db/runtime";
import { authenticateTmaRequestMember } from "@/lib/mini-app/request-auth.server";

function photoBytes(metadata: ChatMetadata | null) {
  return metadata?.photoSmallFileId
    ? fetchTelegramFileBytes(metadata.photoSmallFileId)
    : null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ chatId: string }> },
): Promise<Response> {
  const member = await authenticateTmaRequestMember(
    request.headers.get("authorization"),
  );
  if (!member) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { chatId: rawChatId } = await context.params;
  const chatId = Number(rawChatId);
  if (!Number.isSafeInteger(chatId)) {
    return Response.json({ error: "Invalid Chat" }, { status: 400 });
  }

  const db = await getRuntimeDb();
  if (!(await hasRegistration(db, chatId, member.userId))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

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
