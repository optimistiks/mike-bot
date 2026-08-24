import "server-only";

import { sharesChatWithMember } from "@/lib/db/members";
import { hasRegistration } from "@/lib/db/registrations";
import { getRuntimeDb } from "@/lib/db/runtime";

import { authenticateTmaRequestMember } from "./request-auth.server";

/**
 * The two questions every protected route asks before it does anything, and the
 * refusals it owes when the answer is no (ADR-0009).
 *
 * A guard returns the refusal itself rather than a boolean, because what is
 * duplicated across the routes is not *whether* to refuse but *which* refusal:
 * unauthenticated and unauthorized are different statuses with different bodies,
 * and every route was spelling both out by hand.
 *
 * Each guard runs per request and outside any cache boundary. Identity is
 * cheap to check and permission is the one thing that must never be answered
 * from a cache, so neither result is memoized anywhere.
 */
async function authorize(
  request: Request,
  mayAccess: (
    db: Awaited<ReturnType<typeof getRuntimeDb>>,
    memberId: number,
  ) => Promise<boolean>,
): Promise<Response | null> {
  const member = await authenticateTmaRequestMember(
    request.headers.get("authorization"),
  );
  if (!member) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getRuntimeDb();
  if (!(await mayAccess(db, member.userId))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

/** Refuse unless the caller holds a Registration in this Chat. */
export function requireChatAccess(
  request: Request,
  chatId: number,
): Promise<Response | null> {
  return authorize(request, (db, memberId) =>
    hasRegistration(db, chatId, memberId),
  );
}

/** Refuse unless the caller shares a Chat with this Member. */
export function requireMemberAccess(
  request: Request,
  userId: number,
): Promise<Response | null> {
  return authorize(request, (db, memberId) =>
    sharesChatWithMember(db, memberId, userId),
  );
}
