import { NextResponse } from "next/server";
import { z } from "zod";

import { hasRegistration } from "@/lib/db/registrations";
import { getRuntimeDb } from "@/lib/db/runtime";
import { queryAvailableSeasons } from "@/lib/leaderboard/query";
import { availablePeriodsResponseSchema } from "@/lib/leaderboard/schema";
import { authenticateTmaRequestMember } from "@/lib/mini-app/request-auth.server";

const querySchema = z.object({ chatId: z.coerce.number().int() });

export async function GET(request: Request): Promise<NextResponse> {
  const member = await authenticateTmaRequestMember(
    request.headers.get("authorization"),
  );
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
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
  if (!(await hasRegistration(db, query.data.chatId, member.userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const seasons = await queryAvailableSeasons(db, query.data.chatId);
  return NextResponse.json(availablePeriodsResponseSchema.parse({ seasons }));
}
