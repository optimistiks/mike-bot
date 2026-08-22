import { Api } from "grammy";

import {
  resolveChatMetadata,
  type ChatMetadata,
} from "@/lib/bot/chat-metadata";
import { hasRegistration } from "@/lib/db/registrations";
import { getRuntimeDb } from "@/lib/db/runtime";
import { authenticateTmaRequestMember } from "@/lib/mini-app/request-auth.server";

function telegramFileUrl(botToken: string, filePath: string): string {
  return `https://api.telegram.org/file/bot${botToken}/${filePath}`;
}

async function downloadPhoto(
  metadata: ChatMetadata,
  botToken: string,
): Promise<Response | null> {
  if (!metadata.photoSmallFileId) return null;

  try {
    const file = await new Api(botToken).getFile(metadata.photoSmallFileId);
    if (!file.file_path) return null;

    const response = await fetch(telegramFileUrl(botToken, file.file_path));
    return response.ok ? response : null;
  } catch {
    return null;
  }
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
  let photo = metadata ? await downloadPhoto(metadata, botToken) : null;

  if (!photo) {
    metadata = await resolveChatMetadata(db, chatId, botToken, { force: true });
    photo = metadata ? await downloadPhoto(metadata, botToken) : null;
  }

  if (!photo) {
    return Response.json({ error: "Photo not found" }, { status: 404 });
  }

  return new Response(photo.body, {
    headers: {
      "Cache-Control": "private, max-age=3600",
      "Content-Type": photo.headers.get("content-type") ?? "image/jpeg",
    },
  });
}
