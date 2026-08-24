import { requireMemberAccess } from "@/lib/mini-app/request-access.server";

import {
  fetchTelegramFileBytes,
  resolveMemberPhotoFileId,
} from "@/lib/bot/telegram-photo.server";

/**
 * A Member's Telegram profile photo, proxied.
 *
 * Same bargain as the Chat photo: the bot token is what makes the file
 * readable, so it stays on this side and the browser gets bytes. Unlike a Chat,
 * nothing here is stored — Telegram publishes no version for a profile photo,
 * so the lookup that finds the current one is what has to be repeated.
 *
 * Every failure — no photo, privacy settings, Telegram unreachable — is a 404,
 * and the avatar falls back to initials. There is nothing a Member could do
 * about any of them, so they are not worth telling apart.
 *
 * Authorization stays on the request path rather than in the helpers below it.
 * The bytes are the same for everyone; only permission to see them differs, and
 * permission is the one thing that must never be answered from a cache — which
 * is why the guard runs per request and caches nothing.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ userId: string }> },
): Promise<Response> {
  const { userId: rawUserId } = await context.params;
  const userId = Number(rawUserId);
  if (!Number.isSafeInteger(userId)) {
    return Response.json({ error: "Invalid Member" }, { status: 400 });
  }

  const refusal = await requireMemberAccess(request, userId);
  if (refusal) return refusal;

  const fileId = await resolveMemberPhotoFileId(userId);
  const photo = fileId ? await fetchTelegramFileBytes(fileId) : null;
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
