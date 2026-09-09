DROP INDEX "conversations_one_open_per_chat";--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_one_per_chat" ON "conversations" USING btree ("chat_id");--> statement-breakpoint
ALTER TABLE "conversation_turns" ADD COLUMN "reply_quote" text;--> statement-breakpoint
ALTER TABLE "conversation_turns" ADD COLUMN "reply_target_label" text;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD COLUMN "completing_at" timestamp with time zone;