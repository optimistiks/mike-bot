CREATE TABLE "chats" (
	"chat_id" bigint PRIMARY KEY NOT NULL,
	"last_llm_replied_at" timestamp with time zone,
	"sentry_conversation_bound_at" timestamp with time zone,
	"sentry_conversation_id" uuid
);
--> statement-breakpoint
INSERT INTO "chats" ("chat_id")
SELECT "chat_id" FROM "conversations";
--> statement-breakpoint
CREATE TABLE "chat_turns" (
	"chat_id" bigint NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" bigint,
	"posted_at" timestamp with time zone NOT NULL,
	"reply_quote" text,
	"reply_target_label" text,
	"role" text NOT NULL,
	"seq" integer NOT NULL,
	"speaker_label" text,
	"text" text NOT NULL
);
--> statement-breakpoint
INSERT INTO "chat_turns" (
	"chat_id",
	"id",
	"member_id",
	"posted_at",
	"reply_quote",
	"reply_target_label",
	"role",
	"seq",
	"speaker_label",
	"text"
)
SELECT
	"c"."chat_id",
	"t"."id",
	"t"."member_id",
	"t"."posted_at",
	"t"."reply_quote",
	"t"."reply_target_label",
	"t"."role",
	"t"."seq",
	"t"."speaker_label",
	"t"."text"
FROM "conversation_turns" AS "t"
INNER JOIN "conversations" AS "c" ON "c"."id" = "t"."conversation_id";
--> statement-breakpoint
ALTER TABLE "chat_turns" ADD CONSTRAINT "chat_turns_chat_id_chats_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("chat_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_turns_chat_id_seq" ON "chat_turns" USING btree ("chat_id","seq");--> statement-breakpoint
CREATE TABLE "chat_completion_leases" (
	"chat_id" bigint NOT NULL,
	"completing_at" timestamp with time zone,
	"member_id" bigint NOT NULL,
	CONSTRAINT "chat_completion_leases_chat_id_member_id_pk" PRIMARY KEY("chat_id","member_id")
);
--> statement-breakpoint
INSERT INTO "chat_completion_leases" ("chat_id", "completing_at", "member_id")
SELECT "c"."chat_id", "l"."completing_at", "l"."member_id"
FROM "conversation_completion_leases" AS "l"
INNER JOIN "conversations" AS "c" ON "c"."id" = "l"."conversation_id";
--> statement-breakpoint
ALTER TABLE "chat_completion_leases" ADD CONSTRAINT "chat_completion_leases_chat_id_chats_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("chat_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
DROP TABLE "conversation_completion_leases";--> statement-breakpoint
DROP TABLE "conversation_turns";--> statement-breakpoint
DROP TABLE "conversations";
