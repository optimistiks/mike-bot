import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const members = pgTable("members", {
  telegramId: bigint("telegram_id", { mode: "number" }).primaryKey(),
  username: text("username"),
});

export const messages = pgTable(
  "messages",
  {
    chatId: bigint("chat_id", { mode: "number" }).notNull(),
    messageId: bigint("message_id", { mode: "number" }).notNull(),
    authorId: bigint("author_id", { mode: "number" }).notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.chatId, table.messageId] })],
);

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
      .generatedAlwaysAs(sql`case when "type" = 'humor.add' then 'humor' else 'karma' end`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.chatId, table.actorId, table.messageId, table.slot],
    }),
    check("marks_type_check", sql`${table.type} in ('karma.plus', 'karma.minus', 'humor.add')`),
  ],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: bigint("member_id", { mode: "number" }).notNull(),
    chatId: bigint("chat_id", { mode: "number" }).notNull(),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("conversations_one_open_per_member_chat")
      .on(table.memberId, table.chatId)
      .where(sql`${table.closedAt} is null`),
  ],
);

export const conversationTurns = pgTable("conversation_turns", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id),
  seq: integer("seq").notNull(),
  role: text("role").notNull(),
  text: text("text").notNull(),
});

export const processedUpdates = pgTable("processed_updates", {
  updateId: bigint("update_id", { mode: "number" }).primaryKey(),
});

export const schema = {
  members,
  messages,
  marks,
  conversations,
  conversationTurns,
  processedUpdates,
};

export type Schema = typeof schema;
