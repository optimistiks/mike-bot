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

/** Telegram update_id deduplication for webhook idempotency. */
export const processedUpdates = pgTable("processed_updates", {
  updateId: bigint("update_id", { mode: "number" }).primaryKey(),
});

export const schema = {
  chats,
  marks,
  displayIdentities,
  registrations,
  messageAuthors,
  processedUpdates,
};

export type Schema = typeof schema;
