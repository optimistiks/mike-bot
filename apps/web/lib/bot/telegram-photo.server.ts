import "server-only";

import { cacheLife } from "next/cache";
import { Api } from "grammy";

/**
 * The two Telegram lookups behind an avatar, as plain data.
 *
 * Both are shaped to be cacheable: they take an identifier, they read
 * `BOT_TOKEN` from the environment themselves, and they return serializable
 * bytes rather than a `Response`. Nothing here may touch a request — no
 * `headers()`, no `cookies()`, nothing that reads the caller — because a cached
 * scope cannot, and the restriction follows the whole call stack. Authorization
 * belongs to the route handlers above, where the caller is known.
 *
 * The token is read inside each function rather than passed in: an argument or
 * a module-level constant would be captured into the cache key, and a bot token
 * has no business in a cache key. It also means rotating the token does not
 * invalidate anything, which is right — the bytes are the same either way.
 *
 * `remote` rather than plain `use cache` because this runs on Vercel, where a
 * serverless instance is thrown away between requests and an in-memory entry
 * with it. A shared cache is the only kind that reduces load on a rate-limited
 * Bot API. Note that the fallback is silent: with no platform handler these
 * behave exactly like `use cache`, correct but nearly always missing.
 *
 * A failed lookup is cached too, but only for a minute. Not caching it at all
 * would re-ask Telegram about every photoless Member on every render; caching
 * it for as long as a success would pin one flaky request or a single 429 in
 * place for days.
 */
export interface TelegramPhotoBytes {
  /** Pinned to `ArrayBuffer` because that is what `Response` accepts as a body. */
  bytes: Uint8Array<ArrayBuffer>;
  contentType: string;
}

function telegramFileUrl(botToken: string, filePath: string): string {
  return `https://api.telegram.org/file/bot${botToken}/${filePath}`;
}

/**
 * The bytes of one Telegram file.
 *
 * A `file_id` names an immutable file: a new Chat photo or a new profile photo
 * is a new id, never new bytes under the old one. That is what makes this safe
 * to remember for a long time — the identifier is the version.
 */
export async function fetchTelegramFileBytes(
  fileId: string,
): Promise<TelegramPhotoBytes | null> {
  "use cache: remote";

  const photo = await downloadTelegramFile(fileId);
  if (!photo) {
    cacheLife("minutes");
    return null;
  }

  cacheLife("days");
  return photo;
}

async function downloadTelegramFile(
  fileId: string,
): Promise<TelegramPhotoBytes | null> {
  const botToken = process.env.BOT_TOKEN?.trim();
  if (!botToken) return null;

  try {
    const file = await new Api(botToken).getFile(fileId);
    if (!file.file_path) return null;

    const response = await fetch(telegramFileUrl(botToken, file.file_path));
    if (!response.ok) return null;

    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") ?? "image/jpeg",
    };
  } catch {
    return null;
  }
}

/**
 * Which file is a Member's profile photo right now.
 *
 * The smallest size Telegram offers, which is the one an avatar wants: the
 * sizes arrive ascending, and the largest is a full-resolution portrait nobody
 * is going to look at inside a 32px box.
 *
 * This is the volatile half of a Member avatar. Telegram publishes no version
 * for a profile photo, so this lookup is the only thing that can notice a
 * changed one — which is why it is kept separate from the bytes it points at.
 */
export async function resolveMemberPhotoFileId(
  userId: number,
): Promise<string | null> {
  "use cache: remote";

  const fileId = await readMemberPhotoFileId(userId);
  if (!fileId) {
    cacheLife("minutes");
    return null;
  }

  cacheLife("hours");
  return fileId;
}

async function readMemberPhotoFileId(userId: number): Promise<string | null> {
  const botToken = process.env.BOT_TOKEN?.trim();
  if (!botToken) return null;

  try {
    const photos = await new Api(botToken).getUserProfilePhotos(userId, {
      limit: 1,
    });
    return photos.photos.at(0)?.at(0)?.file_id ?? null;
  } catch {
    return null;
  }
}
