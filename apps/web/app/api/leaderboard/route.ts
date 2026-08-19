import { NextResponse } from "next/server";

import { hasChatMembership } from "@/lib/db/memberships";
import { getRuntimeDb } from "@/lib/db/runtime";
import { parseBotToken } from "@/lib/env.server";
import { queryLeaderboard, resolveSeason } from "@/lib/leaderboard/query";
import {
  leaderboardQuerySchema,
  leaderboardResponseSchema,
} from "@/lib/leaderboard/schema";
import { authenticateTmaMember } from "@/lib/mini-app/init-data";

export async function GET(request: Request): Promise<NextResponse> {
  const member = authenticateTmaMember(
    request.headers.get("authorization"),
    parseBotToken(),
  );

  if (member === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = leaderboardQuerySchema.safeParse({
    chatId: url.searchParams.get("chatId") ?? undefined,
    chat_id: url.searchParams.get("chat_id") ?? undefined,
    year: url.searchParams.get("year") ?? undefined,
    month: url.searchParams.get("month") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters" },
      { status: 400 },
    );
  }

  const db = await getRuntimeDb();

  if (!(await hasChatMembership(db, parsed.data.chatId, member.userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const season = resolveSeason(parsed.data);
  const leaderboard = await queryLeaderboard(db, parsed.data.chatId, season);
  const response = leaderboardResponseSchema.parse(leaderboard);

  return NextResponse.json(response);
}
