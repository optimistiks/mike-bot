CREATE TABLE "chats" (
	"chat_id" bigint PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"photo_small_file_id" text,
	"photo_unique_id" text,
	"metadata_checked_at" timestamp with time zone
);
