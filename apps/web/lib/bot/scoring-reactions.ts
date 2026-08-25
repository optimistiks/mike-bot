import { and, eq } from "drizzle-orm";

import type { AppDatabase } from "@/lib/db/runtime";
import { chatScoringReactions } from "@/lib/db/schema";
import type { MarkType } from "@/lib/domain/mark";

import { DEFAULT_SCORING_REACTIONS, type ScoringReactionMap } from "./emojis";

/** One reaction a Chat has in play, and the Mark it places, if any. */
export interface ChatReaction {
  reactionKey: string;
  markType: MarkType | null;
  label: string | null;
}

/** Everything one Chat has in play, unbound reactions included. */
export async function loadChatReactions(
  db: AppDatabase,
  chatId: number,
): Promise<ChatReaction[]> {
  const rows = await db
    .select({
      reactionKey: chatScoringReactions.reactionKey,
      markType: chatScoringReactions.markType,
      label: chatScoringReactions.label,
    })
    .from(chatScoringReactions)
    .where(eq(chatScoringReactions.chatId, chatId));

  return rows.map((row) => ({
    reactionKey: row.reactionKey,
    markType: row.markType as MarkType | null,
    label: row.label,
  }));
}

/**
 * What a Chat scores by.
 *
 * The one place the fallback rule is stated: a Chat with no rows at all has
 * never been configured and scores by the built-in defaults. A Chat with rows
 * scores by exactly its bound ones — including by none, which is why the rows
 * a save writes are never deleted (ADR-0019). Without that invariant, a Chat
 * that unassigned everything would silently revert to the defaults.
 */
export function bindingsFromReactions(
  reactions: readonly ChatReaction[],
): ScoringReactionMap {
  if (reactions.length === 0) return DEFAULT_SCORING_REACTIONS;

  return new Map(
    reactions.flatMap((reaction) =>
      reaction.markType
        ? [[reaction.reactionKey, reaction.markType] as const]
        : [],
    ),
  );
}

/** Load and resolve one Chat's bindings for the reader. */
export async function resolveChatBindings(
  db: AppDatabase,
  chatId: number,
): Promise<ScoringReactionMap> {
  return bindingsFromReactions(await loadChatReactions(db, chatId));
}

/**
 * The palette as the Mini App sees it.
 *
 * An unconfigured Chat has no rows, so its built-in bindings are synthesised
 * here rather than written to the table — writing them would make the Chat read
 * as configured and cost the "no rows means defaults" rule its meaning.
 */
export function chatReactionsView(reactions: readonly ChatReaction[]): {
  reactions: ChatReaction[];
  usingDefaults: boolean;
} {
  if (reactions.length > 0) {
    return {
      reactions: [...reactions].sort((left, right) =>
        left.reactionKey.localeCompare(right.reactionKey),
      ),
      usingDefaults: false,
    };
  }

  return {
    reactions: [...DEFAULT_SCORING_REACTIONS].map(
      ([reactionKey, markType]) => ({
        reactionKey,
        markType,
        label: null,
      }),
    ),
    usingDefaults: true,
  };
}

export type AddChatReactionResult = "added" | "already_present";

/**
 * Put one reaction in a Chat's palette, bound to nothing.
 *
 * `onConflictDoNothing` is load-bearing twice over: it is what tells an
 * addition from a repeat without reading first, and what stops re-adding a
 * reaction the Chat has already *bound* from resetting it to unbound.
 */
export async function addChatReaction(
  db: AppDatabase,
  input: { chatId: number; reactionKey: string; label: string | null },
  now: Date,
): Promise<AddChatReactionResult> {
  const inserted = await db
    .insert(chatScoringReactions)
    .values({
      chatId: input.chatId,
      reactionKey: input.reactionKey,
      markType: null,
      label: input.label,
      createdAt: now,
    })
    .onConflictDoNothing()
    .returning();

  return inserted.length > 0 ? "added" : "already_present";
}

export type ReplaceBindingsResult =
  { ok: true } | { ok: false; unknown: string[] };

/**
 * Replace every Reaction binding a Chat holds.
 *
 * Binding only ever re-types a row that already exists: the palette is grown
 * by the Add reaction command alone, never by a save. That single rule is what
 * stops a reaction Telegram would never deliver from being bound, since
 * `/addreaction` already refused those on the way in.
 * A key the Chat has never seen is refused rather than silently ignored, so a
 * stale client learns its palette has moved on.
 *
 * Unbinds everything first, then materialises a row for each built-in
 * reaction, then binds what was asked. The materialising step is what makes
 * the first save unambiguous: afterwards the Chat has rows whatever it bound,
 * so "no rows" keeps meaning "never configured". Nothing is ever deleted, so
 * an Unassigned reaction survives a save that leaves it unbound.
 */
export async function replaceChatBindings(
  db: AppDatabase,
  chatId: number,
  bindings: ReadonlyMap<string, MarkType>,
  now: Date,
): Promise<ReplaceBindingsResult> {
  const palette = new Set([
    ...(await loadChatReactions(db, chatId)).map((row) => row.reactionKey),
    ...DEFAULT_SCORING_REACTIONS.keys(),
  ]);

  const unknown = [...bindings.keys()].filter((key) => !palette.has(key));
  if (unknown.length > 0) return { ok: false, unknown };

  await db
    .update(chatScoringReactions)
    .set({ markType: null })
    .where(eq(chatScoringReactions.chatId, chatId));

  for (const reactionKey of DEFAULT_SCORING_REACTIONS.keys()) {
    await db
      .insert(chatScoringReactions)
      .values({
        chatId,
        reactionKey,
        markType: null,
        label: null,
        createdAt: now,
      })
      .onConflictDoNothing();
  }

  for (const [reactionKey, markType] of bindings) {
    await db
      .update(chatScoringReactions)
      .set({ markType })
      .where(
        and(
          eq(chatScoringReactions.chatId, chatId),
          eq(chatScoringReactions.reactionKey, reactionKey),
        ),
      );
  }

  return { ok: true };
}
