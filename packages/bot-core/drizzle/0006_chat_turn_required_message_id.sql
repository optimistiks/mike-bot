TRUNCATE TABLE "chat_turns";--> statement-breakpoint
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
