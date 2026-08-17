CREATE TABLE "wanjiedaoyou_sponsorship_admin_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"action" varchar(64) NOT NULL,
	"order_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_sponsorship_checkout_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(32) NOT NULL,
	"user_id" uuid,
	"cultivator_id" uuid,
	"tier" varchar(32) NOT NULL,
	"expected_plan_id" varchar(80),
	"public_listing" boolean DEFAULT true NOT NULL,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"provider_order_id" varchar(80),
	"config_snapshot" jsonb NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_sponsorship_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"code_hash" varchar(64) NOT NULL,
	"code" text NOT NULL,
	"public_listing" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"cultivator_id" uuid,
	"claimed_at" timestamp,
	"message_status" varchar(24) DEFAULT 'pending' NOT NULL,
	"message_attempts" integer DEFAULT 0 NOT NULL,
	"last_message_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_sponsorship_merit_profiles" (
	"cultivator_id" uuid PRIMARY KEY NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"highest_tier" varchar(32) NOT NULL,
	"merit_count" integer DEFAULT 0 NOT NULL,
	"first_supported_at" timestamp NOT NULL,
	"last_supported_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_sponsorship_merit_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid,
	"cultivator_id" uuid NOT NULL,
	"tier" varchar(32) NOT NULL,
	"source" varchar(32) NOT NULL,
	"supported_at" timestamp NOT NULL,
	"mail_id" uuid,
	"created_by" uuid,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_sponsorship_order_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"source" varchar(24) NOT NULL,
	"payload" jsonb NOT NULL,
	"purge_after" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_sponsorship_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(32) NOT NULL,
	"provider_order_id" varchar(80) NOT NULL,
	"custom_order_id" varchar(128),
	"provider_user_id" varchar(80),
	"plan_id" varchar(80),
	"sku_id" varchar(80),
	"product_type" integer,
	"total_amount_fen" integer,
	"show_amount_fen" integer,
	"month" integer,
	"provider_status" integer,
	"provider_created_at" timestamp,
	"verification_status" varchar(24) DEFAULT 'received' NOT NULL,
	"fulfillment_status" varchar(24) DEFAULT 'pending' NOT NULL,
	"resolved_tier" varchar(32),
	"checkout_intent_id" uuid,
	"config_snapshot" jsonb,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"last_error_code" varchar(80),
	"last_error_message" text,
	"signature_verified_at" timestamp,
	"verified_at" timestamp,
	"fulfilled_at" timestamp,
	"revoked_at" timestamp,
	"sensitive_purged_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sponsorship_admin_actions" ADD CONSTRAINT "wanjiedaoyou_sponsorship_admin_actions_order_id_wanjiedaoyou_sponsorship_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."wanjiedaoyou_sponsorship_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sponsorship_checkout_intents" ADD CONSTRAINT "wanjiedaoyou_sponsorship_checkout_intents_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sponsorship_claims" ADD CONSTRAINT "wanjiedaoyou_sponsorship_claims_order_id_wanjiedaoyou_sponsorship_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."wanjiedaoyou_sponsorship_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sponsorship_claims" ADD CONSTRAINT "wanjiedaoyou_sponsorship_claims_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sponsorship_merit_profiles" ADD CONSTRAINT "wanjiedaoyou_sponsorship_merit_profiles_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sponsorship_merit_records" ADD CONSTRAINT "wanjiedaoyou_sponsorship_merit_records_order_id_wanjiedaoyou_sponsorship_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."wanjiedaoyou_sponsorship_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sponsorship_merit_records" ADD CONSTRAINT "wanjiedaoyou_sponsorship_merit_records_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sponsorship_merit_records" ADD CONSTRAINT "wanjiedaoyou_sponsorship_merit_records_mail_id_wanjiedaoyou_mails_id_fk" FOREIGN KEY ("mail_id") REFERENCES "public"."wanjiedaoyou_mails"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sponsorship_order_snapshots" ADD CONSTRAINT "wanjiedaoyou_sponsorship_order_snapshots_order_id_wanjiedaoyou_sponsorship_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."wanjiedaoyou_sponsorship_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sponsorship_orders" ADD CONSTRAINT "wanjiedaoyou_sponsorship_orders_checkout_intent_id_wanjiedaoyou_sponsorship_checkout_intents_id_fk" FOREIGN KEY ("checkout_intent_id") REFERENCES "public"."wanjiedaoyou_sponsorship_checkout_intents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sponsorship_admin_actions_admin_created_idx" ON "wanjiedaoyou_sponsorship_admin_actions" USING btree ("admin_user_id","created_at");--> statement-breakpoint
CREATE INDEX "sponsorship_admin_actions_order_created_idx" ON "wanjiedaoyou_sponsorship_admin_actions" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sponsorship_checkout_provider_order_uidx" ON "wanjiedaoyou_sponsorship_checkout_intents" USING btree ("provider","provider_order_id");--> statement-breakpoint
CREATE INDEX "sponsorship_checkout_user_created_idx" ON "wanjiedaoyou_sponsorship_checkout_intents" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "sponsorship_checkout_status_expires_idx" ON "wanjiedaoyou_sponsorship_checkout_intents" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sponsorship_claims_order_uidx" ON "wanjiedaoyou_sponsorship_claims" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sponsorship_claims_code_hash_uidx" ON "wanjiedaoyou_sponsorship_claims" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "sponsorship_claims_status_expires_idx" ON "wanjiedaoyou_sponsorship_claims" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "sponsorship_merit_public_tier_first_idx" ON "wanjiedaoyou_sponsorship_merit_profiles" USING btree ("is_public","highest_tier","first_supported_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sponsorship_merit_order_uidx" ON "wanjiedaoyou_sponsorship_merit_records" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "sponsorship_merit_cultivator_supported_idx" ON "wanjiedaoyou_sponsorship_merit_records" USING btree ("cultivator_id","supported_at");--> statement-breakpoint
CREATE INDEX "sponsorship_snapshots_order_created_idx" ON "wanjiedaoyou_sponsorship_order_snapshots" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "sponsorship_snapshots_purge_idx" ON "wanjiedaoyou_sponsorship_order_snapshots" USING btree ("purge_after");--> statement-breakpoint
CREATE UNIQUE INDEX "sponsorship_orders_provider_order_uidx" ON "wanjiedaoyou_sponsorship_orders" USING btree ("provider","provider_order_id");--> statement-breakpoint
CREATE INDEX "sponsorship_orders_verification_created_idx" ON "wanjiedaoyou_sponsorship_orders" USING btree ("verification_status","created_at");--> statement-breakpoint
CREATE INDEX "sponsorship_orders_fulfillment_created_idx" ON "wanjiedaoyou_sponsorship_orders" USING btree ("fulfillment_status","created_at");--> statement-breakpoint
CREATE INDEX "sponsorship_orders_provider_user_idx" ON "wanjiedaoyou_sponsorship_orders" USING btree ("provider_user_id");
