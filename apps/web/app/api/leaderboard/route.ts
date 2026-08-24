import { NextResponse } from "next/server";

import { getRuntimeDb } from "@/lib/db/runtime";
import { queryLeaderboard, resolvePeriod } from "@/lib/leaderboard/query";
import {
  leaderboardQuerySchema,
  leaderboardResponseSchema,
} from "@/lib/leaderboard/schema";
import { requireChatAccess } from "@/lib/mini-app/request-access.server";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);

  const refusal = await requireChatAccess(
    request,
    url.searchParams.get("chat_id"),
  );
  if (refusal) return refusal;

  const parsed = leaderboardQuerySchema.safeParse({
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
  const period = resolvePeriod(parsed.data);
  const leaderboard = await queryLeaderboard(db, parsed.data.chatId, period);
  const response = leaderboardResponseSchema.parse(leaderboard);

  return NextResponse.json(response);
}
