ALTER TABLE "chat_members" RENAME TO "display_identities";--> statement-breakpoint
ALTER TABLE "chat_memberships" RENAME TO "registrations";--> statement-breakpoint
ALTER TABLE "display_identities" RENAME CONSTRAINT "chat_members_chat_id_user_id_pk" TO "display_identities_chat_id_user_id_pk";--> statement-breakpoint
ALTER TABLE "registrations" RENAME CONSTRAINT "chat_memberships_chat_id_user_id_pk" TO "registrations_chat_id_user_id_pk";
