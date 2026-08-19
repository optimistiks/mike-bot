CREATE TABLE "registration_messages" (
	"chat_id" bigint NOT NULL,
	"message_id" bigint NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "registration_messages_chat_id_message_id_pk" PRIMARY KEY("chat_id","message_id")
);
