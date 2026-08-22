import { redirect } from "next/navigation";

import { chatIdFromStartParam } from "./_lib/start-param";

export const dynamic = "force-dynamic";

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
