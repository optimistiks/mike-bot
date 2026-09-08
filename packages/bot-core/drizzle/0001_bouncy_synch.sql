DROP INDEX "conversations_one_open_per_chat";--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_one_per_chat" ON "conversations" USING btree ("chat_id");