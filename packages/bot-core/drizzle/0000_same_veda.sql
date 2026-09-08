CREATE TABLE "conversation_participants" (
	"conversation_id" uuid NOT NULL,
	"joined_at" timestamp with time zone NOT NULL,
	"member_id" bigint NOT NULL,
	CONSTRAINT "conversation_participants_conversation_id_member_id_pk" PRIMARY KEY("conversation_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "conversation_turns" (
	"conversation_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" text NOT NULL,
	"seq" integer NOT NULL,
	"speaker_label" text,
	"member_id" bigint,
	"text" text NOT NULL,
	"posted_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"chat_id" bigint NOT NULL,
	"closed_at" timestamp with time zone,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opened_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marks" (
	"actor_id" bigint NOT NULL,
	"chat_id" bigint NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"message_id" bigint NOT NULL,
	"slot" text GENERATED ALWAYS AS (case when "type" = 'humor.add' then 'humor' else 'karma' end) STORED NOT NULL,
	"subject_id" bigint NOT NULL,
	"type" text NOT NULL,
	CONSTRAINT "marks_chat_id_actor_id_message_id_slot_pk" PRIMARY KEY("chat_id","actor_id","message_id","slot"),
	CONSTRAINT "marks_type_check" CHECK ("marks"."type" in ('karma.plus', 'karma.minus', 'humor.add'))
);
--> statement-breakpoint
CREATE TABLE "members" (
	"telegram_id" bigint PRIMARY KEY NOT NULL,
	"username" text,
	"first_name" text,
	"last_name" text
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"author_id" bigint NOT NULL,
	"chat_id" bigint NOT NULL,
	"message_id" bigint NOT NULL,
	"posted_at" timestamp with time zone NOT NULL,
	CONSTRAINT "messages_chat_id_message_id_pk" PRIMARY KEY("chat_id","message_id")
);
--> statement-breakpoint
CREATE TABLE "processed_updates" (
	"update_id" bigint PRIMARY KEY NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_turns" ADD CONSTRAINT "conversation_turns_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_turns_conversation_id_seq" ON "conversation_turns" USING btree ("conversation_id","seq");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_one_open_per_chat" ON "conversations" USING btree ("chat_id") WHERE "conversations"."closed_at" is null;