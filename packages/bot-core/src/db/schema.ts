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

const members = pgTable("members", {
  firstName: text("first_name"),
  lastName: text("last_name"),
  telegramId: bigint("telegram_id", { mode: "number" }).primaryKey(),
  username: text("username"),
});

const messages = pgTable(
  "messages",
  {
    authorId: bigint("author_id", { mode: "number" }).notNull(),
    chatId: bigint("chat_id", { mode: "number" }).notNull(),
    messageId: bigint("message_id", { mode: "number" }).notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.chatId, table.messageId] })],
);

const marks = pgTable(
  "marks",
  {
    actorId: bigint("actor_id", { mode: "number" }).notNull(),
    chatId: bigint("chat_id", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    messageId: bigint("message_id", { mode: "number" }).notNull(),
    slot: text("slot")
      .notNull()
      .generatedAlwaysAs(sql`case when "type" = 'humor.add' then 'humor' else 'karma' end`),
    subjectId: bigint("subject_id", { mode: "number" }).notNull(),
    type: text("type").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.chatId, table.actorId, table.messageId, table.slot],
    }),
    check("marks_type_check", sql`${table.type} in ('karma.plus', 'karma.minus', 'humor.add')`),
  ],
);

const conversations = pgTable(
  "conversations",
  {
    chatId: bigint("chat_id", { mode: "number" }).notNull(),
    id: uuid("id").primaryKey().defaultRandom(),
  },
  (table) => [uniqueIndex("conversations_one_per_chat").on(table.chatId)],
);

const conversationCompletionLeases = pgTable(
  "conversation_completion_leases",
  {
    completingAt: timestamp("completing_at", { withTimezone: true }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id),
    memberId: bigint("member_id", { mode: "number" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.conversationId, table.memberId] })],
);

const conversationTurns = pgTable(
  "conversation_turns",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id),
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: bigint("member_id", { mode: "number" }),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
    replyQuote: text("reply_quote"),
    replyTargetLabel: text("reply_target_label"),
    role: text("role").notNull(),
    seq: integer("seq").notNull(),
    speakerLabel: text("speaker_label"),
    text: text("text").notNull(),
  },
  (table) => [
    uniqueIndex("conversation_turns_conversation_id_seq").on(table.conversationId, table.seq),
  ],
);

const processedUpdates = pgTable("processed_updates", {
  updateId: bigint("update_id", { mode: "number" }).primaryKey(),
});

const schema = {
  conversationCompletionLeases,
  conversationTurns,
  conversations,
  marks,
  members,
  messages,
  processedUpdates,
};

type Schema = typeof schema;

export {
  conversationCompletionLeases,
  conversationTurns,
  conversations,
  marks,
  members,
  messages,
  processedUpdates,
  schema,
  type Schema,
};
