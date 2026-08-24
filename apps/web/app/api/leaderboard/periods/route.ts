import { NextResponse } from "next/server";
import { z } from "zod";

import { getRuntimeDb } from "@/lib/db/runtime";
import { queryAvailableSeasons } from "@/lib/leaderboard/query";
import { availablePeriodsResponseSchema } from "@/lib/leaderboard/schema";
import { requireChatAccess } from "@/lib/mini-app/request-access.server";

const querySchema = z.object({ chatId: z.coerce.number().int() });

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);

  const refusal = await requireChatAccess(
    request,
    url.searchParams.get("chat_id"),
  );
  if (refusal) return refusal;

  const query = querySchema.safeParse({
    chatId: url.searchParams.get("chat_id") ?? undefined,
  });
  if (!query.success) {
    return NextResponse.json(
      { error: "Invalid query parameters" },
      { status: 400 },
    );
  }

  const db = await getRuntimeDb();
  const seasons = await queryAvailableSeasons(db, query.data.chatId);
  return NextResponse.json(availablePeriodsResponseSchema.parse({ seasons }));
}
