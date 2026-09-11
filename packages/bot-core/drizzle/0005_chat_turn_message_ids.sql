ALTER TABLE "chat_turns" ADD COLUMN "message_id" bigint;--> statement-breakpoint
ALTER TABLE "chat_turns" ADD COLUMN "reply_posted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "chat_turns" ADD COLUMN "reply_to_message_id" bigint;