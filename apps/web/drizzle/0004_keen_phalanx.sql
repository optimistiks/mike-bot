ALTER TABLE "events" ADD COLUMN "reversible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "reverses_event_id" integer;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_reverses_event_id_events_id_fk" FOREIGN KEY ("reverses_event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_active_mark_lookup_idx" ON "events" USING btree ("chat_id","actor_id","message_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "events_reverses_event_id_unique" ON "events" USING btree ("reverses_event_id");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_type_check" CHECK ("events"."type" in ('karma.plus', 'karma.minus', 'humor.add'));--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_reversal_not_self_check" CHECK ("events"."reverses_event_id" is null or "events"."reverses_event_id" <> "events"."id");