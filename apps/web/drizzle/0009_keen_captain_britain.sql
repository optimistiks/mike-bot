CREATE TABLE "chat_scoring_reactions" (
	"chat_id" bigint NOT NULL,
	"reaction_key" text NOT NULL,
	"mark_type" text,
	"label" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "chat_scoring_reactions_chat_id_reaction_key_pk" PRIMARY KEY("chat_id","reaction_key"),
	CONSTRAINT "chat_scoring_reactions_mark_type_check" CHECK ("chat_scoring_reactions"."mark_type" is null or "chat_scoring_reactions"."mark_type" in ('karma.plus', 'karma.minus', 'humor.add')),
	CONSTRAINT "chat_scoring_reactions_key_check" CHECK ("chat_scoring_reactions"."reaction_key" like 'emoji:%' or "chat_scoring_reactions"."reaction_key" like 'custom_emoji:%')
);
