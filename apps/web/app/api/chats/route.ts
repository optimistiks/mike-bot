import { NextResponse } from "next/server";

import { getRuntimeDb } from "@/lib/db/runtime";
import { parseBotToken } from "@/lib/env.server";
import { listChatsForUser } from "@/lib/mini-app/chats-query";
import { authenticateTmaMember } from "@/lib/mini-app/init-data";
import { chatsResponseSchema } from "@/lib/mini-app/schema";

export async function GET(request: Request): Promise<NextResponse> {
  const member = authenticateTmaMember(
    request.headers.get("authorization"),
    parseBotToken(),
  );

  if (member === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getRuntimeDb();
  const chats = await listChatsForUser(db, member.userId);
  const response = chatsResponseSchema.parse({ chats });

  return NextResponse.json(response);
}
