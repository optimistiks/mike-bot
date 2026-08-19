import { NextResponse } from "next/server";

import { getRuntimeDb } from "@/lib/db/runtime";
import { listChatsForUser } from "@/lib/mini-app/chats-query";
import { parseUserIdFromAuthorization } from "@/lib/mini-app/init-data";
import { chatsResponseSchema } from "@/lib/mini-app/schema";

export async function GET(request: Request): Promise<NextResponse> {
  const userId = parseUserIdFromAuthorization(
    request.headers.get("authorization"),
  );

  if (userId === null) {
    return NextResponse.json(
      { error: "Missing or invalid initData" },
      { status: 401 },
    );
  }

  const db = await getRuntimeDb();
  const chats = await listChatsForUser(db, userId);
  const response = chatsResponseSchema.parse({ chats });

  return NextResponse.json(response);
}
