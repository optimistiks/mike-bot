UPDATE "chat_turns" SET "message_id" = -"seq" WHERE "message_id" IS NULL;--> statement-breakpoint
UPDATE "chat_turns"
SET
	"reply_posted_at" = NULL,
	"reply_quote" = NULL,
	"reply_to_message_id" = NULL
WHERE "reply_target_label" IS NULL
	AND (
		"reply_posted_at" IS NOT NULL
		OR "reply_quote" IS NOT NULL
		OR "reply_to_message_id" IS NOT NULL
	);--> statement-breakpoint
UPDATE "chat_turns"
SET
	"reply_posted_at" = COALESCE("reply_posted_at", "posted_at"),
	"reply_to_message_id" = COALESCE("reply_to_message_id", 0)
WHERE "reply_target_label" IS NOT NULL
	AND (
		"reply_posted_at" IS NULL
		OR "reply_to_message_id" IS NULL
	);--> statement-breakpoint
ALTER TABLE "chat_turns" ALTER COLUMN "message_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_turns" ADD CONSTRAINT "chat_turns_reply_identity" CHECK ((
        (
          "chat_turns"."reply_target_label" is null
          and "chat_turns"."reply_to_message_id" is null
          and "chat_turns"."reply_posted_at" is null
          and "chat_turns"."reply_quote" is null
        )
        or (
          "chat_turns"."reply_target_label" is not null
          and "chat_turns"."reply_to_message_id" is not null
          and "chat_turns"."reply_posted_at" is not null
        )
      ));
