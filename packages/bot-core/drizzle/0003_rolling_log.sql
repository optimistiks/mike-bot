CREATE TABLE "conversation_completion_leases" (
	"completing_at" timestamp with time zone,
	"conversation_id" uuid NOT NULL,
	"member_id" bigint NOT NULL,
	CONSTRAINT "conversation_completion_leases_conversation_id_member_id_pk" PRIMARY KEY("conversation_id","member_id")
);
--> statement-breakpoint
ALTER TABLE "conversation_completion_leases" ADD CONSTRAINT "conversation_completion_leases_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
WITH "keepers" AS (
	SELECT DISTINCT ON ("chat_id") "id"
	FROM "conversations"
	ORDER BY "chat_id",
		CASE WHEN "opened_at" IS NULL OR "closed_at" IS NULL THEN 0 ELSE 1 END,
		COALESCE("closed_at", "opened_at") DESC NULLS LAST
)
DELETE FROM "conversation_turns"
WHERE "conversation_id" NOT IN (SELECT "id" FROM "keepers");--> statement-breakpoint
DELETE FROM "conversation_participants";--> statement-breakpoint
WITH "keepers" AS (
	SELECT DISTINCT ON ("chat_id") "id"
	FROM "conversations"
	ORDER BY "chat_id",
		CASE WHEN "opened_at" IS NULL OR "closed_at" IS NULL THEN 0 ELSE 1 END,
		COALESCE("closed_at", "opened_at") DESC NULLS LAST
)
DELETE FROM "conversations"
WHERE "id" NOT IN (SELECT "id" FROM "keepers");--> statement-breakpoint
DELETE FROM "conversation_turns" AS "t"
WHERE "t"."seq" < (
	SELECT COALESCE(MAX("t2"."seq") - 99, 0)
	FROM "conversation_turns" AS "t2"
	WHERE "t2"."conversation_id" = "t"."conversation_id"
);--> statement-breakpoint
DROP TABLE "conversation_participants";--> statement-breakpoint
DROP INDEX "conversations_one_open_per_chat";--> statement-breakpoint
DROP INDEX "conversations_one_unopened_per_chat";--> statement-breakpoint
DROP INDEX "conversations_one_active_per_chat";--> statement-breakpoint
ALTER TABLE "conversations" DROP COLUMN "closed_at";--> statement-breakpoint
ALTER TABLE "conversations" DROP COLUMN "opened_at";--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_one_per_chat" ON "conversations" USING btree ("chat_id");
