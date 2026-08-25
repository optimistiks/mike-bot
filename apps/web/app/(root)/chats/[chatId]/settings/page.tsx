import { notFound } from "next/navigation";

import { SettingsRoute } from "../../../_components/settings-route";

/** Same shape as the Leaderboard pages: see the note there. */
export const instant = false;

export const metadata = { title: "Реакции" };

export default async function ScoringReactionsPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId: rawChatId } = await params;
  const chatId = Number(rawChatId);
  if (!Number.isSafeInteger(chatId)) notFound();

  return <SettingsRoute chatId={chatId} />;
}
