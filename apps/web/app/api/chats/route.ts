import { NextResponse } from "next/server";

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
  const chats = await listChatsForUser(db, member.userId);
  const response = chatsResponseSchema.parse({ chats });

  return NextResponse.json(response);
}
