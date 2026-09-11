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

const chats = pgTable("chats", {
  chatId: bigint("chat_id", { mode: "number" }).primaryKey(),
  lastLlmRepliedAt: timestamp("last_llm_replied_at", { withTimezone: true }),
  sentryConversationBoundAt: timestamp("sentry_conversation_bound_at", { withTimezone: true }),
  sentryConversationId: uuid("sentry_conversation_id"),
});

const chatCompletionLeases = pgTable(
  "chat_completion_leases",
  {
    chatId: bigint("chat_id", { mode: "number" })
      .notNull()
      .references(() => chats.chatId),
    completingAt: timestamp("completing_at", { withTimezone: true }),
    memberId: bigint("member_id", { mode: "number" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.chatId, table.memberId] })],
);

const chatTurns = pgTable(
  "chat_turns",
  {
    chatId: bigint("chat_id", { mode: "number" })
      .notNull()
      .references(() => chats.chatId),
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: bigint("member_id", { mode: "number" }),
    messageId: bigint("message_id", { mode: "number" }),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
    replyPostedAt: timestamp("reply_posted_at", { withTimezone: true }),
    replyQuote: text("reply_quote"),
    replyTargetLabel: text("reply_target_label"),
    replyToMessageId: bigint("reply_to_message_id", { mode: "number" }),
    role: text("role").notNull(),
    seq: integer("seq").notNull(),
    speakerLabel: text("speaker_label"),
    text: text("text").notNull(),
  },
  (table) => [uniqueIndex("chat_turns_chat_id_seq").on(table.chatId, table.seq)],
);

const processedUpdates = pgTable("processed_updates", {
  updateId: bigint("update_id", { mode: "number" }).primaryKey(),
});

const schema = {
  chatCompletionLeases,
  chatTurns,
  chats,
  marks,
  members,
  messages,
  processedUpdates,
};

type Schema = typeof schema;

export {
  chatCompletionLeases,
  chatTurns,
  chats,
  marks,
  members,
  messages,
  processedUpdates,
  schema,
  type Schema,
};
