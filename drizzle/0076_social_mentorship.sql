CREATE TABLE "wanjiedaoyou_direct_conversation_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid,
	"original_cultivator_id" uuid,
	"name" varchar(100) NOT NULL,
	"last_read_sequence" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_direct_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pair_key" varchar(80) NOT NULL,
	"last_sequence" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wanjiedaoyou_direct_conversations_pair_key_unique" UNIQUE("pair_key")
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_direct_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_member_id" uuid NOT NULL,
	"sender_name" varchar(100) NOT NULL,
	"sequence" bigint NOT NULL,
	"text_content" text,
	"client_message_id" uuid NOT NULL,
	"request_fingerprint" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expired_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_friend_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pair_key" varchar(80) NOT NULL,
	"requester_cultivator_id" uuid NOT NULL,
	"recipient_cultivator_id" uuid NOT NULL,
	"requester_user_id" uuid NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"request_id" uuid NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_mentorship_account_states" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"first_mentor_user_id" uuid,
	"first_mentor_cultivator_id" uuid,
	"first_bound_at" timestamp with time zone,
	"supply_claimed_at" timestamp with time zone,
	"supply_cultivator_id" uuid,
	"revision" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_mentorship_guidance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"relation_id" uuid NOT NULL,
	"mentor_user_id" uuid NOT NULL,
	"disciple_user_id" uuid NOT NULL,
	"milestone_key" varchar(32) NOT NULL,
	"content" text NOT NULL,
	"baseline_value" integer NOT NULL,
	"sequence" bigint NOT NULL,
	"credited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_mentorship_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"cultivator_id" uuid,
	"open" boolean DEFAULT false NOT NULL,
	"directions" text[] DEFAULT '{}'::text[] NOT NULL,
	"available_times" text DEFAULT '' NOT NULL,
	"introduction" text DEFAULT '' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_mentorship_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mentor_user_id" uuid NOT NULL,
	"disciple_user_id" uuid NOT NULL,
	"mentor_cultivator_id" uuid,
	"disciple_cultivator_id" uuid,
	"mentor_original_cultivator_id" uuid NOT NULL,
	"disciple_original_cultivator_id" uuid NOT NULL,
	"mentor_name" varchar(100) NOT NULL,
	"disciple_name" varchar(100) NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"mentor_seat" integer NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"guidance_sequence" bigint DEFAULT 0 NOT NULL,
	"apprentice_seen_guidance_sequence" bigint DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"end_reason" text,
	CONSTRAINT "mentorship_seat_check" CHECK ("wanjiedaoyou_mentorship_relations"."mentor_seat" in (1, 2))
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_mentorship_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mentor_user_id" uuid NOT NULL,
	"disciple_user_id" uuid NOT NULL,
	"mentor_cultivator_id" uuid NOT NULL,
	"disciple_cultivator_id" uuid NOT NULL,
	"initiator_user_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_social_accounts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_social_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blocked_user_id" uuid NOT NULL,
	"target_name" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_account_deletion_records" ADD COLUMN "social_cleanup_status" varchar(16) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_account_deletion_records" ADD COLUMN "social_cleanup_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_account_deletion_records" ADD COLUMN "social_cleanup_error" text;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_account_deletion_records" ADD COLUMN "social_cleanup_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_direct_conversation_members" ADD CONSTRAINT "wanjiedaoyou_direct_conversation_members_conversation_id_wanjiedaoyou_direct_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."wanjiedaoyou_direct_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_direct_messages" ADD CONSTRAINT "wanjiedaoyou_direct_messages_conversation_id_wanjiedaoyou_direct_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."wanjiedaoyou_direct_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_direct_messages" ADD CONSTRAINT "wanjiedaoyou_direct_messages_sender_member_id_wanjiedaoyou_direct_conversation_members_id_fk" FOREIGN KEY ("sender_member_id") REFERENCES "public"."wanjiedaoyou_direct_conversation_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_mentorship_guidance" ADD CONSTRAINT "wanjiedaoyou_mentorship_guidance_relation_id_wanjiedaoyou_mentorship_relations_id_fk" FOREIGN KEY ("relation_id") REFERENCES "public"."wanjiedaoyou_mentorship_relations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "direct_members_character_uidx" ON "wanjiedaoyou_direct_conversation_members" USING btree ("conversation_id","original_cultivator_id");--> statement-breakpoint
CREATE INDEX "direct_members_user_idx" ON "wanjiedaoyou_direct_conversation_members" USING btree ("user_id","conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "direct_messages_sequence_uidx" ON "wanjiedaoyou_direct_messages" USING btree ("conversation_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "direct_messages_request_uidx" ON "wanjiedaoyou_direct_messages" USING btree ("sender_member_id","client_message_id");--> statement-breakpoint
CREATE INDEX "direct_messages_created_idx" ON "wanjiedaoyou_direct_messages" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "friend_requests_pending_pair_uidx" ON "wanjiedaoyou_friend_requests" USING btree ("pair_key") WHERE "wanjiedaoyou_friend_requests"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "friend_requests_request_uidx" ON "wanjiedaoyou_friend_requests" USING btree ("requester_user_id","request_id");--> statement-breakpoint
CREATE INDEX "friend_requests_recipient_idx" ON "wanjiedaoyou_friend_requests" USING btree ("recipient_user_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "friend_requests_requester_idx" ON "wanjiedaoyou_friend_requests" USING btree ("requester_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "mentorship_guidance_sequence_uidx" ON "wanjiedaoyou_mentorship_guidance" USING btree ("relation_id","sequence");--> statement-breakpoint
CREATE INDEX "mentorship_guidance_relation_idx" ON "wanjiedaoyou_mentorship_guidance" USING btree ("relation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "mentorship_active_disciple_uidx" ON "wanjiedaoyou_mentorship_relations" USING btree ("disciple_user_id") WHERE "wanjiedaoyou_mentorship_relations"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "mentorship_active_seat_uidx" ON "wanjiedaoyou_mentorship_relations" USING btree ("mentor_user_id","mentor_seat") WHERE "wanjiedaoyou_mentorship_relations"."status" = 'active';--> statement-breakpoint
CREATE INDEX "mentorship_relations_mentor_idx" ON "wanjiedaoyou_mentorship_relations" USING btree ("mentor_user_id","started_at");--> statement-breakpoint
CREATE INDEX "mentorship_relations_disciple_idx" ON "wanjiedaoyou_mentorship_relations" USING btree ("disciple_user_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "mentorship_requests_pending_uidx" ON "wanjiedaoyou_mentorship_requests" USING btree ("mentor_cultivator_id","disciple_cultivator_id") WHERE "wanjiedaoyou_mentorship_requests"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "mentorship_requests_request_uidx" ON "wanjiedaoyou_mentorship_requests" USING btree ("initiator_user_id","request_id");--> statement-breakpoint
CREATE INDEX "mentorship_requests_disciple_idx" ON "wanjiedaoyou_mentorship_requests" USING btree ("disciple_user_id","status");--> statement-breakpoint
CREATE INDEX "mentorship_requests_mentor_idx" ON "wanjiedaoyou_mentorship_requests" USING btree ("mentor_user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "social_blocks_pair_uidx" ON "wanjiedaoyou_social_blocks" USING btree ("user_id","blocked_user_id");