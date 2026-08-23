import { redirect } from "next/navigation";

import { chatIdFromStartParam } from "./_lib/start-param";

/**
 * The entry point cannot render instantly, and should not pretend to: it reads
 * the Telegram start parameter and redirects, with no UI of its own. Blocking
 * is also what keeps the redirect a real 3xx — deferring it into a Suspense
 * boundary would deliver it in the stream after a 200, and a deep link into a
 * Chat is the whole reason this route exists.
 */
export const instant = false;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { persona, tgWebAppStartParam } = await searchParams;
  const chatId = chatIdFromStartParam(tgWebAppStartParam);
  const pathname =
    chatId === null ? "/chats" : `/chats/${String(chatId)}/leaderboards`;
  const destination = new URL(pathname, "http://mini-app.local");
  if (typeof persona === "string") {
    destination.searchParams.set("persona", persona);
  }
  redirect(`${destination.pathname}${destination.search}`);
}
