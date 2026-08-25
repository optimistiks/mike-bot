import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * One row per spent grant: at most one Mark per Chat, Actor, Message, and slot,
 * enforced by the primary key rather than by application code (ADR-0015).
 */
export const marks = pgTable(
  "marks",
  {
    chatId: bigint("chat_id", { mode: "number" }).notNull(),
    actorId: bigint("actor_id", { mode: "number" }).notNull(),
    subjectId: bigint("subject_id", { mode: "number" }).notNull(),
    messageId: bigint("message_id", { mode: "number" }).notNull(),
    type: text("type").notNull(),
    slot: text("slot")
      .notNull()
      .generatedAlwaysAs(
        sql`case when "type" = 'humor.add' then 'humor' else 'karma' end`,
      ),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    source: text("source").notNull(),
    /**
     * The Telegram update that placed this Mark. Telegram timestamps are whole
     * seconds, so a fast tap and untap tie on `created_at`; `update_id` is
     * monotonic and totally orders them. Null for Imported Marks, which have no
     * update, and for Marks predating this column.
     */
    updateId: bigint("update_id", { mode: "number" }),
    /**
     * Set when a Scoring reaction was taken back inside the Undo window. The row
     * is kept as a tombstone rather than deleted so that an addition handled
     * after its own removal collides with the primary key and loses, instead of
     * landing in empty space (ADR-0015).
     */
    undoneAt: timestamp("undone_at", { withTimezone: true }),
    legacyId: uuid("legacy_id").unique(),
  },
  (table) => [
    primaryKey({
      columns: [table.chatId, table.actorId, table.messageId, table.slot],
    }),
    index("marks_chat_id_created_at_idx").on(table.chatId, table.createdAt),
    check(
      "marks_type_check",
      sql`${table.type} in ('karma.plus', 'karma.minus', 'humor.add')`,
    ),
    check("marks_source_check", sql`${table.source} in ('reaction', 'reply')`),
  ],
);

/** Latest known display name per Member in a Chat. */
export const displayIdentities = pgTable(
  "display_identities",
  {
    chatId: bigint("chat_id", { mode: "number" }).notNull(),
    userId: bigint("user_id", { mode: "number" }).notNull(),
    displayName: text("display_name").notNull(),
  },
  (table) => [primaryKey({ columns: [table.chatId, table.userId] })],
);

/** Members explicitly registered for Mini App access in each Chat. */
export const registrations = pgTable(
  "registrations",
  {
    chatId: bigint("chat_id", { mode: "number" }).notNull(),
    userId: bigint("user_id", { mode: "number" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.chatId, table.userId] })],
);

/** Latest Telegram-owned metadata for a group or supergroup Chat. */
export const chats = pgTable("chats", {
  chatId: bigint("chat_id", { mode: "number" }).primaryKey(),
  title: text("title").notNull(),
  photoSmallFileId: text("photo_small_file_id"),
  photoUniqueId: text("photo_unique_id"),
  metadataCheckedAt: timestamp("metadata_checked_at", { withTimezone: true }),
});

/** Cached message authors for Subject lookup on reaction updates. */
export const messageAuthors = pgTable(
  "message_authors",
  {
    chatId: bigint("chat_id", { mode: "number" }).notNull(),
    messageId: bigint("message_id", { mode: "number" }).notNull(),
    authorId: bigint("author_id", { mode: "number" }).notNull(),
    authorIsBot: boolean("author_is_bot").notNull(),
    messageDate: integer("message_date").notNull(),
  },
  (table) => [primaryKey({ columns: [table.chatId, table.messageId] })],
);

/**
 * Telegram update_id deduplication for webhook idempotency.
 *
 * Prune by `update_id`, which is monotonic per bot, but keep a generous margin:
 * this table is what stops a redelivered addition from resurrecting a Mark its
 * Actor undid (ADR-0015). Note that pointing a *different* bot token at the
 * same database restarts `update_id` near 1, and every new update would then
 * read as a duplicate.
 */
export const processedUpdates = pgTable("processed_updates", {
  updateId: bigint("update_id", { mode: "number" }).primaryKey(),
});

/**
 * One row per reaction a Chat has put in play, holding the single Mark it is
 * bound to.
 *
 * The primary key is the whole enforcement: a reaction has exactly one
 * `mark_type` column, so binding one reaction to two Marks is not a state this
 * table can hold. Nothing is checked because nothing can be wrong — the same
 * move `marks` makes, where a second Mark in a slot loses to the key (ADR-0015,
 * ADR-0019). `mark_type` NULL means the Chat has the reaction available but
 * scores nothing by it: what `/addreaction` produces, and what unassigning in
 * the Mini App leaves behind.
 *
 * Rows are inserted and re-typed, never deleted. That is what makes "this Chat
 * has no rows" mean "never configured, use the built-in defaults" even for a
 * Chat that has deliberately assigned zero reactions to every Mark.
 */
export const chatScoringReactions = pgTable(
  "chat_scoring_reactions",
  {
    chatId: bigint("chat_id", { mode: "number" }).notNull(),
    /** Exactly the key `reactionKey()` produces: `emoji:👍` or `custom_emoji:<id>`. */
    reactionKey: text("reaction_key").notNull(),
    markType: text("mark_type"),
    /** Base emoji standing in for a custom reaction, so the Mini App can draw it. */
    label: text("label"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.chatId, table.reactionKey] }),
    check(
      "chat_scoring_reactions_mark_type_check",
      sql`${table.markType} is null or ${table.markType} in ('karma.plus', 'karma.minus', 'humor.add')`,
    ),
    // `paid` is the third shape reactionKey() emits and names no Member, so it
    // must never become bindable.
    check(
      "chat_scoring_reactions_key_check",
      sql`${table.reactionKey} like 'emoji:%' or ${table.reactionKey} like 'custom_emoji:%'`,
    ),
  ],
);

export const schema = {
  chats,
  marks,
  displayIdentities,
  registrations,
  messageAuthors,
  processedUpdates,
  chatScoringReactions,
};

export type Schema = typeof schema;
