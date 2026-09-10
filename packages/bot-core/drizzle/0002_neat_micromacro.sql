DROP INDEX "conversations_one_per_chat";--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "opened_at" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_one_open_per_chat" ON "conversations" USING btree ("chat_id") WHERE "conversations"."closed_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_one_unopened_per_chat" ON "conversations" USING btree ("chat_id") WHERE "conversations"."opened_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_one_active_per_chat" ON "conversations" USING btree ("chat_id") WHERE "conversations"."opened_at" is null or "conversations"."closed_at" is null;