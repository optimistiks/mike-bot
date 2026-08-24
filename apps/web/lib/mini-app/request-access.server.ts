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
 * unauthenticated, unparseable and unauthorized are three statuses with three
 * bodies, and every route was spelling them out by hand.
 *
 * Each guard runs per request and outside any cache boundary. Identity is
 * cheap to check and permission is the one thing that must never be answered
 * from a cache, so neither result is memoized anywhere.
 */
function identifier(raw: unknown): number | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  if (raw === "") return null;

  const value = Number(raw);

  return Number.isSafeInteger(value) ? value : null;
}

/**
 * Authenticate, then parse, then authorize — in that order, always.
 *
 * Parsing last of the two refusals would tell an unauthenticated caller
 * whether an id is well formed, so identity is settled before the request is
 * examined at all.
 */
async function authorize(
  request: Request,
  raw: unknown,
  mayAccess: (
    db: Awaited<ReturnType<typeof getRuntimeDb>>,
    memberId: number,
    id: number,
  ) => Promise<boolean>,
): Promise<Response | null> {
  const member = await authenticateTmaRequestMember(
    request.headers.get("authorization"),
  );
  if (!member) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = identifier(raw);
  if (id === null) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const db = await getRuntimeDb();
  if (!(await mayAccess(db, member.userId, id))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

/** Refuse unless the caller holds a Registration in the Chat they named. */
export function requireChatAccess(
  request: Request,
  rawChatId: unknown,
): Promise<Response | null> {
  return authorize(request, rawChatId, (db, memberId, chatId) =>
    hasRegistration(db, chatId, memberId),
  );
}

/** Refuse unless the caller shares a Chat with the Member they named. */
export function requireMemberAccess(
  request: Request,
  rawUserId: unknown,
): Promise<Response | null> {
  return authorize(request, rawUserId, (db, memberId, userId) =>
    sharesChatWithMember(db, memberId, userId),
  );
}
