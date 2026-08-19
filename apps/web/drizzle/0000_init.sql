CREATE TABLE "chat_members" (
	"chat_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"display_name" text NOT NULL,
	CONSTRAINT "chat_members_chat_id_user_id_pk" PRIMARY KEY("chat_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "chat_memberships" (
	"chat_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	CONSTRAINT "chat_memberships_chat_id_user_id_pk" PRIMARY KEY("chat_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"chat_id" bigint NOT NULL,
	"actor_id" bigint NOT NULL,
	"subject_id" bigint NOT NULL,
	"message_id" bigint NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"legacy_id" uuid,
	CONSTRAINT "events_legacy_id_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "message_authors" (
	"chat_id" bigint NOT NULL,
	"message_id" bigint NOT NULL,
	"author_id" bigint NOT NULL,
	"author_is_bot" boolean NOT NULL,
	"message_date" integer NOT NULL,
	CONSTRAINT "message_authors_chat_id_message_id_pk" PRIMARY KEY("chat_id","message_id")
);
--> statement-breakpoint
CREATE TABLE "processed_updates" (
	"update_id" bigint PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE INDEX "events_chat_id_created_at_idx" ON "events" USING btree ("chat_id","created_at");