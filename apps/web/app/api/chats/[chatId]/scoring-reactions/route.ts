import { isChatAdmin } from "@/lib/bot/chat-admin";
import {
  scoringReactionsRequestSchema,
  scoringReactionsResponseSchema,
} from "@/lib/bot/scoring-reactions-schema";
import {
  chatReactionsView,
  loadChatReactions,
  replaceChatBindings,
} from "@/lib/bot/scoring-reactions";
import { getRuntimeDb, type AppDatabase } from "@/lib/db/runtime";
import { MARK_TYPES, type MarkType } from "@/lib/domain/mark";
import { parseBotToken } from "@/lib/env.server";
import {
  requireChatAccess,
  requireChatAdminAccess,
} from "@/lib/mini-app/request-access.server";
import { authenticateTmaRequestMember } from "@/lib/mini-app/request-auth.server";

/**
 * Who is asking, once a guard has already let them past.
 *
 * The guards answer whether to refuse, not who the caller is, so the identity
 * is read again here. It is a signature check over a header the request already
 * carries — no database, no network.
 */
async function callerId(request: Request): Promise<number | null> {
  const member = await authenticateTmaRequestMember(
    request.headers.get("authorization"),
  );

  return member?.userId ?? null;
}

/**
 * A Chat's Scoring reactions: which reaction places which Mark (ADR-0019).
 *
 * No CSRF token guards the write. Authentication is an `Authorization: tma …`
 * header rather than a cookie, so a cross-origin request carries no credentials
 * to abuse.
 */
async function respond(
  db: AppDatabase,
  chatId: number,
  memberId: number | null,
): Promise<Response> {
  const view = chatReactionsView(await loadChatReactions(db, chatId));

  const canEdit =
    memberId !== null && (await isChatAdmin(chatId, memberId, parseBotToken()));

  return Response.json(
    scoringReactionsResponseSchema.parse({ ...view, canEdit }),
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ chatId: string }> },
): Promise<Response> {
  const { chatId: rawChatId } = await context.params;

  // Any registered Member may see what the Chat scores by; only an
  // administrator may change it.
  const refusal = await requireChatAccess(request, rawChatId);
  if (refusal) return refusal;

  const db = await getRuntimeDb();

  return respond(db, Number(rawChatId), await callerId(request));
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ chatId: string }> },
): Promise<Response> {
  const { chatId: rawChatId } = await context.params;

  const refusal = await requireChatAdminAccess(request, rawChatId);
  if (refusal) return refusal;

  const body: unknown = await request.json().catch(() => null);
  const parsed = scoringReactionsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const bindings = new Map<string, MarkType>();
  for (const markType of MARK_TYPES) {
    for (const key of parsed.data.bindings[markType] ?? []) {
      bindings.set(key, markType);
    }
  }

  const chatId = Number(rawChatId);
  const db = await getRuntimeDb();

  const result = await db.transaction(async (transaction) =>
    replaceChatBindings(
      transaction as unknown as AppDatabase,
      chatId,
      bindings,
      new Date(),
    ),
  );

  // Binding does not grow the palette — the Add reaction command does. A key
  // the Chat has never seen means the client is working from a stale palette,
  // which is worth saying rather than silently dropping.
  if (!result.ok) {
    return Response.json(
      { error: "Unknown reaction", unknown: result.unknown },
      { status: 400 },
    );
  }

  return respond(db, chatId, await callerId(request));
}
