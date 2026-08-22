import type { Metadata } from "next";

import { ChatsRoute } from "../_components/chats-route";

export const metadata: Metadata = { title: "Чаты" };

export default function ChatsPage() {
  return <ChatsRoute />;
}
