import { NextResponse } from "next/server";

import { hasRegistration } from "@/lib/db/registrations";
import { getRuntimeDb } from "@/lib/db/runtime";
import { queryLeaderboard, resolvePeriod } from "@/lib/leaderboard/query";
import {
  leaderboardQuerySchema,
  leaderboardResponseSchema,
} from "@/lib/leaderboard/schema";
import { authenticateTmaRequestMember } from "@/lib/mini-app/request-auth.server";

export async function GET(request: Request): Promise<NextResponse> {
  const member = await authenticateTmaRequestMember(
    request.headers.get("authorization"),
  );

  if (member === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
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

  if (!(await hasRegistration(db, parsed.data.chatId, member.userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const period = resolvePeriod(parsed.data);
  const leaderboard = await queryLeaderboard(db, parsed.data.chatId, period);
  const response = leaderboardResponseSchema.parse(leaderboard);

  return NextResponse.json(response);
}
