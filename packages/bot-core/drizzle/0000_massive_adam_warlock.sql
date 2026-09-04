CREATE TABLE "conversation_turns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"role" text NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" bigint NOT NULL,
	"chat_id" bigint NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "marks" (
	"chat_id" bigint NOT NULL,
	"actor_id" bigint NOT NULL,
	"subject_id" bigint NOT NULL,
	"message_id" bigint NOT NULL,
	"type" text NOT NULL,
	"slot" text GENERATED ALWAYS AS (case when "type" = 'humor.add' then 'humor' else 'karma' end) STORED NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "marks_chat_id_actor_id_message_id_slot_pk" PRIMARY KEY("chat_id","actor_id","message_id","slot"),
	CONSTRAINT "marks_type_check" CHECK ("marks"."type" in ('karma.plus', 'karma.minus', 'humor.add'))
);
--> statement-breakpoint
CREATE TABLE "members" (
	"telegram_id" bigint PRIMARY KEY NOT NULL,
	"username" text
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"chat_id" bigint NOT NULL,
	"message_id" bigint NOT NULL,
	"author_id" bigint NOT NULL,
	"posted_at" timestamp with time zone NOT NULL,
	CONSTRAINT "messages_chat_id_message_id_pk" PRIMARY KEY("chat_id","message_id")
);
--> statement-breakpoint
CREATE TABLE "processed_updates" (
	"update_id" bigint PRIMARY KEY NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation_turns" ADD CONSTRAINT "conversation_turns_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_one_open_per_member_chat" ON "conversations" USING btree ("member_id","chat_id") WHERE "conversations"."closed_at" is null;