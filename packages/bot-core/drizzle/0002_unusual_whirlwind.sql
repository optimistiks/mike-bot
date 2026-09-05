CREATE TABLE "conversation_participants" (
	"conversation_id" uuid NOT NULL,
	"joined_at" timestamp with time zone NOT NULL,
	"member_id" bigint NOT NULL,
	CONSTRAINT "conversation_participants_conversation_id_member_id_pk" PRIMARY KEY("conversation_id","member_id")
);
--> statement-breakpoint
DROP INDEX "conversations_one_open_per_member_chat";--> statement-breakpoint
ALTER TABLE "conversation_turns" ADD COLUMN "speaker_label" text;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_one_open_per_chat" ON "conversations" USING btree ("chat_id") WHERE "conversations"."closed_at" is null;--> statement-breakpoint
ALTER TABLE "conversations" DROP COLUMN "member_id";