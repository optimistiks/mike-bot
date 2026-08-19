import { NextResponse } from "next/server";

import { getRuntimeDb } from "@/lib/db/runtime";
import { queryLeaderboard, resolveSeason } from "@/lib/leaderboard/query";
import {
  leaderboardQuerySchema,
  leaderboardResponseSchema,
} from "@/lib/leaderboard/schema";

export async function GET(request: Request): Promise<NextResponse> {
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

  const season = resolveSeason(parsed.data);
  const leaderboard = await queryLeaderboard(db, parsed.data.chatId, season);
  const response = leaderboardResponseSchema.parse(leaderboard);

  return NextResponse.json(response);
}
