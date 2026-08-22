import { Api } from "grammy";

import { sharesChatWithMember } from "@/lib/db/members";
import { getRuntimeDb } from "@/lib/db/runtime";
import { authenticateTmaRequestMember } from "@/lib/mini-app/request-auth.server";

function telegramFileUrl(botToken: string, filePath: string): string {
  return `https://api.telegram.org/file/bot${botToken}/${filePath}`;
}

/**
 * The smallest size Telegram offers, which is the one an avatar wants: the
 * sizes arrive ascending, and the largest is a full-resolution portrait nobody
 * is going to look at inside a 32px box.
 */
async function downloadPhoto(
  userId: number,
  botToken: string,
): Promise<Response | null> {
  try {
    const api = new Api(botToken);
    const photos = await api.getUserProfilePhotos(userId, { limit: 1 });
    const fileId = photos.photos.at(0)?.at(0)?.file_id;
    if (!fileId) return null;

    const file = await api.getFile(fileId);
    if (!file.file_path) return null;

    const response = await fetch(telegramFileUrl(botToken, file.file_path));
    return response.ok ? response : null;
  } catch {
    return null;
  }
}

/**
 * A Member's Telegram profile photo, proxied.
 *
 * Same bargain as the Chat photo: the bot token is what makes the file
 * readable, so it stays on this side and the browser gets bytes. Unlike a Chat,
 * nothing here is stored — Telegram is asked each time the browser's hour-long
 * cache lapses, because a profile photo has no version this app ever sees.
 *
 * Every failure — no photo, privacy settings, Telegram unreachable — is a 404,
 * and the avatar falls back to initials. There is nothing a Member could do
 * about any of them, so they are not worth telling apart.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ userId: string }> },
): Promise<Response> {
  const member = await authenticateTmaRequestMember(
    request.headers.get("authorization"),
  );
  if (!member) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { userId: rawUserId } = await context.params;
  const userId = Number(rawUserId);
  if (!Number.isSafeInteger(userId)) {
    return Response.json({ error: "Invalid Member" }, { status: 400 });
  }

  const db = await getRuntimeDb();
  if (!(await sharesChatWithMember(db, member.userId, userId))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const botToken = process.env.BOT_TOKEN?.trim();
  if (!botToken) {
    return Response.json({ error: "Photo unavailable" }, { status: 404 });
  }

  const photo = await downloadPhoto(userId, botToken);
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
