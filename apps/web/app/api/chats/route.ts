import { NextResponse } from "next/server";

import { resolveChatMetadata } from "@/lib/bot/chat-metadata";
import { getRuntimeDb } from "@/lib/db/runtime";
import { listChatsForUser } from "@/lib/mini-app/chats-query";
import { authenticateTmaRequestMember } from "@/lib/mini-app/request-auth.server";
import { chatsResponseSchema } from "@/lib/mini-app/schema";

export async function GET(request: Request): Promise<NextResponse> {
  const member = await authenticateTmaRequestMember(
    request.headers.get("authorization"),
  );

  if (member === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getRuntimeDb();
  let registeredChats = await listChatsForUser(db, member.userId);
  const botToken = process.env.BOT_TOKEN?.trim();

  if (botToken) {
    registeredChats = await Promise.all(
      registeredChats.map(async (chat) => {
        const metadata = await resolveChatMetadata(db, chat.chatId, botToken);
        return metadata
          ? {
              chatId: metadata.chatId,
              title: metadata.title,
              photoVersion: metadata.photoUniqueId,
            }
          : chat;
      }),
    );
  }

  const response = chatsResponseSchema.parse({ chats: registeredChats });

  return NextResponse.json(response);
}
