CREATE TABLE "wanjiedaoyou_chat_messages" (
	"id" varchar(160) PRIMARY KEY NOT NULL,
	"sequence" bigint NOT NULL,
	"channel" varchar(16) NOT NULL,
	"sect_id" uuid,
	"sender_user_id" varchar(128) NOT NULL,
	"sender_cultivator_id" uuid,
	"sender_name" varchar(100) NOT NULL,
	"sender_realm" varchar(32) NOT NULL,
	"sender_realm_stage" varchar(16) NOT NULL,
	"message_type" varchar(32) NOT NULL,
	"text_content" text,
	"payload" jsonb NOT NULL,
	"reply" jsonb,
	"client_message_id" uuid,
	"request_fingerprint" varchar(64),
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_chat_red_packet_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"packet_id" uuid NOT NULL,
	"claimer_user_id" uuid NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"sender_name" varchar(100) NOT NULL,
	"amount" integer NOT NULL,
	"claimed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chat_red_packet_claims_amount_check" CHECK ("wanjiedaoyou_chat_red_packet_claims"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_chat_red_packets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"message_snapshot" jsonb,
	"sender_user_id" uuid NOT NULL,
	"sender_cultivator_id" uuid NOT NULL,
	"client_message_id" uuid NOT NULL,
	"request_fingerprint" varchar(64) NOT NULL,
	"channel" varchar(16) NOT NULL,
	"sect_id" uuid,
	"amount" integer NOT NULL,
	"count" integer NOT NULL,
	"amounts" jsonb NOT NULL,
	"mode" varchar(16) NOT NULL,
	"greeting" varchar(100) NOT NULL,
	"remaining_amount" integer NOT NULL,
	"remaining_count" integer NOT NULL,
	"status" varchar(16) DEFAULT 'open' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"refund_status" varchar(16) DEFAULT 'none' NOT NULL,
	"refund_amount" integer DEFAULT 0 NOT NULL,
	"refund_cultivator_id" uuid,
	"refunded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "chat_red_packets_amounts_check" CHECK ("wanjiedaoyou_chat_red_packets"."amount" >= 50000 and "wanjiedaoyou_chat_red_packets"."amount" <= 10000000 and "wanjiedaoyou_chat_red_packets"."count" >= 1 and "wanjiedaoyou_chat_red_packets"."count" <= 100 and "wanjiedaoyou_chat_red_packets"."remaining_amount" >= 0 and "wanjiedaoyou_chat_red_packets"."remaining_count" >= 0 and "wanjiedaoyou_chat_red_packets"."remaining_count" <= "wanjiedaoyou_chat_red_packets"."count" and "wanjiedaoyou_chat_red_packets"."refund_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_chat_sequence" (
	"key" varchar(16) PRIMARY KEY NOT NULL,
	"value" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_chat_red_packet_claims" ADD CONSTRAINT "wanjiedaoyou_chat_red_packet_claims_packet_id_wanjiedaoyou_chat_red_packets_id_fk" FOREIGN KEY ("packet_id") REFERENCES "public"."wanjiedaoyou_chat_red_packets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_messages_sequence_unique" ON "wanjiedaoyou_chat_messages" USING btree ("sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_messages_client_unique" ON "wanjiedaoyou_chat_messages" USING btree ("sender_user_id","client_message_id") WHERE "wanjiedaoyou_chat_messages"."client_message_id" is not null;--> statement-breakpoint
CREATE INDEX "chat_messages_channel_sequence_idx" ON "wanjiedaoyou_chat_messages" USING btree ("channel","sect_id","sequence");--> statement-breakpoint
CREATE INDEX "chat_messages_created_idx" ON "wanjiedaoyou_chat_messages" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_red_packet_claims_account_unique" ON "wanjiedaoyou_chat_red_packet_claims" USING btree ("packet_id","claimer_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_red_packets_request_unique" ON "wanjiedaoyou_chat_red_packets" USING btree ("sender_user_id","client_message_id");--> statement-breakpoint
CREATE INDEX "chat_red_packets_expiry_idx" ON "wanjiedaoyou_chat_red_packets" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "chat_red_packets_refunds_idx" ON "wanjiedaoyou_chat_red_packets" USING btree ("sender_user_id","refund_status");