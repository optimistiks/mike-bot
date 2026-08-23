CREATE TABLE "marks" (
	"chat_id" bigint NOT NULL,
	"actor_id" bigint NOT NULL,
	"subject_id" bigint NOT NULL,
	"message_id" bigint NOT NULL,
	"type" text NOT NULL,
	"slot" text GENERATED ALWAYS AS (case when "type" = 'humor.add' then 'humor' else 'karma' end) STORED NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"source" text NOT NULL,
	"legacy_id" uuid,
	CONSTRAINT "marks_chat_id_actor_id_message_id_slot_pk" PRIMARY KEY("chat_id","actor_id","message_id","slot"),
	CONSTRAINT "marks_legacy_id_unique" UNIQUE("legacy_id"),
	CONSTRAINT "marks_type_check" CHECK ("marks"."type" in ('karma.plus', 'karma.minus', 'humor.add')),
	CONSTRAINT "marks_source_check" CHECK ("marks"."source" in ('reaction', 'reply'))
);
--> statement-breakpoint
DROP TABLE "events" CASCADE;--> statement-breakpoint
CREATE INDEX "marks_chat_id_created_at_idx" ON "marks" USING btree ("chat_id","created_at");