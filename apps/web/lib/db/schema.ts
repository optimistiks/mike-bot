import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** Append-only scoring log, except deterministic v1 reconciliation by legacyId. */
export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    type: text("type").notNull(),
    chatId: bigint("chat_id", { mode: "number" }).notNull(),
    actorId: bigint("actor_id", { mode: "number" }).notNull(),
    subjectId: bigint("subject_id", { mode: "number" }).notNull(),
    messageId: bigint("message_id", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    reversible: boolean("reversible").notNull().default(false),
    reversesEventId: integer("reverses_event_id").references(
      (): AnyPgColumn => events.id,
    ),
    legacyId: uuid("legacy_id").unique(),
  },
  (table) => [
    index("events_chat_id_created_at_idx").on(table.chatId, table.createdAt),
    index("events_active_mark_lookup_idx").on(
      table.chatId,
      table.actorId,
      table.messageId,
      table.type,
    ),
    uniqueIndex("events_reverses_event_id_unique").on(table.reversesEventId),
    check(
      "events_type_check",
      sql`${table.type} in ('karma.plus', 'karma.minus', 'humor.add')`,
    ),
    check(
      "events_reversal_not_self_check",
      sql`${table.reversesEventId} is null or ${table.reversesEventId} <> ${table.id}`,
    ),
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

/** Bot-posted Registration messages; any reaction registers the actor for Mini App access. */
export const registrationMessages = pgTable(
  "registration_messages",
  {
    chatId: bigint("chat_id", { mode: "number" }).notNull(),
    messageId: bigint("message_id", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.chatId, table.messageId] })],
);

/** Telegram update_id deduplication for webhook idempotency. */
export const processedUpdates = pgTable("processed_updates", {
  updateId: bigint("update_id", { mode: "number" }).primaryKey(),
});

export const schema = {
  chats,
  events,
  displayIdentities,
  registrations,
  messageAuthors,
  registrationMessages,
  processedUpdates,
};

export type Schema = typeof schema;
