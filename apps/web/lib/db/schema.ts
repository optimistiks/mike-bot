import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/** Append-only scoring log. Rows are never updated or deleted. */
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
    legacyId: uuid("legacy_id").unique(),
  },
  (table) => [
    index("events_chat_id_created_at_idx").on(table.chatId, table.createdAt),
  ],
);

/** Latest known display name per Member in a Chat. */
export const chatMembers = pgTable(
  "chat_members",
  {
    chatId: bigint("chat_id", { mode: "number" }).notNull(),
    userId: bigint("user_id", { mode: "number" }).notNull(),
    displayName: text("display_name").notNull(),
  },
  (table) => [primaryKey({ columns: [table.chatId, table.userId] })],
);

/** Roster of Members in Chats where the bot is present (Mini App picker). */
export const chatMemberships = pgTable(
  "chat_memberships",
  {
    chatId: bigint("chat_id", { mode: "number" }).notNull(),
    userId: bigint("user_id", { mode: "number" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.chatId, table.userId] })],
);

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
  events,
  chatMembers,
  chatMemberships,
  messageAuthors,
  processedUpdates,
};

export type Schema = typeof schema;
