CREATE TABLE "wanjiedaoyou_admin_message_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" varchar(20) NOT NULL,
	"name" varchar(120) NOT NULL,
	"subject_template" varchar(300),
	"content_template" text NOT NULL,
	"default_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_alchemy_formulas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"family" varchar(20) NOT NULL,
	"pattern" jsonb NOT NULL,
	"blueprint" jsonb NOT NULL,
	"mastery" jsonb DEFAULT '{"level":0,"exp":0}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_app_settings" (
	"key" varchar(128) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_auction_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"seller_name" varchar(100) NOT NULL,
	"item_type" varchar(20) NOT NULL,
	"item_id" uuid NOT NULL,
	"item_snapshot" jsonb NOT NULL,
	"price" integer NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"sold_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_battle_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"challenge_type" varchar(20),
	"opponent_cultivator_id" uuid,
	"battle_result" jsonb NOT NULL,
	"battle_report" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_battle_records_v2" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"battle_type" varchar(20) DEFAULT 'normal' NOT NULL,
	"opponent_cultivator_id" uuid,
	"engine_version" varchar(40) DEFAULT 'battle-v5' NOT NULL,
	"result_version" integer DEFAULT 2 NOT NULL,
	"battle_result" jsonb NOT NULL,
	"battle_report" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_bet_battles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"creator_name" varchar(100) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"min_realm" varchar(20) NOT NULL,
	"max_realm" varchar(20) NOT NULL,
	"taunt" varchar(20),
	"creator_stake_snapshot" jsonb NOT NULL,
	"challenger_stake_snapshot" jsonb,
	"challenger_id" uuid,
	"challenger_name" varchar(100),
	"winner_cultivator_id" uuid,
	"battle_record_id" uuid,
	"battle_record_v2_id" uuid,
	"expires_at" timestamp NOT NULL,
	"matched_at" timestamp,
	"settled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_breakthrough_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"from_realm" varchar(20) NOT NULL,
	"from_stage" varchar(10) NOT NULL,
	"to_realm" varchar(20) NOT NULL,
	"to_stage" varchar(10) NOT NULL,
	"age" integer NOT NULL,
	"years_spent" integer NOT NULL,
	"story" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_consumables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(20) NOT NULL,
	"prompt" varchar(200) DEFAULT '' NOT NULL,
	"quality" varchar(20) DEFAULT '凡品' NOT NULL,
	"spec" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"description" text,
	"score" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_creation_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"product_type" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"element" varchar(10),
	"quality" varchar(20),
	"slot" varchar(20),
	"score" integer DEFAULT 0 NOT NULL,
	"is_equipped" boolean DEFAULT false NOT NULL,
	"product_model" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_cultivator_state_versions" (
	"cultivator_id" uuid PRIMARY KEY NOT NULL,
	"global_version" bigint DEFAULT 0 NOT NULL,
	"profile_version" bigint DEFAULT 0 NOT NULL,
	"condition_version" bigint DEFAULT 0 NOT NULL,
	"progress_version" bigint DEFAULT 0 NOT NULL,
	"currency_version" bigint DEFAULT 0 NOT NULL,
	"inventory_version" bigint DEFAULT 0 NOT NULL,
	"products_version" bigint DEFAULT 0 NOT NULL,
	"mail_version" bigint DEFAULT 0 NOT NULL,
	"tasks_version" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_cultivator_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"definition_id" varchar(120) NOT NULL,
	"category" varchar(40) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"current_stage" varchar(120),
	"objectives" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_cultivators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"title" varchar(50),
	"gender" varchar(10),
	"origin" varchar(100),
	"personality" text,
	"background" text,
	"prompt" text NOT NULL,
	"realm" varchar(20) NOT NULL,
	"realm_stage" varchar(10) NOT NULL,
	"age" integer DEFAULT 18 NOT NULL,
	"lifespan" integer DEFAULT 100 NOT NULL,
	"closed_door_years_total" integer DEFAULT 0,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"died_at" timestamp,
	"vitality" integer NOT NULL,
	"spirit" integer NOT NULL,
	"wisdom" integer NOT NULL,
	"speed" integer NOT NULL,
	"willpower" integer NOT NULL,
	"spirit_stones" integer DEFAULT 0 NOT NULL,
	"reputation" integer DEFAULT 0 NOT NULL,
	"qi" integer DEFAULT 200 NOT NULL,
	"qi_last_refreshed_at" timestamp DEFAULT now() NOT NULL,
	"last_yield_at" timestamp DEFAULT now(),
	"max_skills" integer DEFAULT 4 NOT NULL,
	"balance_notes" text,
	"condition" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"game_settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cultivation_progress" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_dungeon_histories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"theme" varchar(100) NOT NULL,
	"result" jsonb NOT NULL,
	"log" text NOT NULL,
	"real_gains" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_dungeon_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"map_node_id" varchar(100) NOT NULL,
	"status" varchar(30) DEFAULT 'EXPLORING' NOT NULL,
	"current_round" integer DEFAULT 1 NOT NULL,
	"max_rounds" integer DEFAULT 5 NOT NULL,
	"danger_score" integer DEFAULT 10 NOT NULL,
	"run_state" jsonb NOT NULL,
	"cost_ledger" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"gain_ledger" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pending_action" jsonb,
	"active_battle_id" uuid,
	"battle_payload" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_feedbacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"cultivator_id" uuid,
	"type" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_item_library" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" varchar(120) NOT NULL,
	"type" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'published' NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"quality" varchar(20),
	"element" varchar(10),
	"category" varchar(40),
	"payload" jsonb NOT NULL,
	"editor_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_mails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"type" varchar(20) DEFAULT 'system' NOT NULL,
	"attachments" jsonb,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_claimed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(20) NOT NULL,
	"rank" varchar(20) NOT NULL,
	"element" varchar(10),
	"description" text,
	"details" jsonb DEFAULT '{}'::jsonb,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_player_state_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "wanjiedaoyou_player_state_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"cultivator_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"global_version" bigint NOT NULL,
	"domain_version" bigint NOT NULL,
	"domain" varchar(32) NOT NULL,
	"event_type" varchar(96) NOT NULL,
	"patch" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"invalidates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" varchar(96) NOT NULL,
	"request_id" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_pre_heaven_fates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"quality" varchar(10),
	"effects" jsonb DEFAULT '[]'::jsonb,
	"registry_key" varchar(100),
	"details" jsonb DEFAULT '{}'::jsonb,
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_qi_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"action" varchar(64) NOT NULL,
	"action_instance_id" varchar(128) NOT NULL,
	"status" varchar(32) NOT NULL,
	"qi_cost" integer DEFAULT 0 NOT NULL,
	"qi_gain" integer DEFAULT 0 NOT NULL,
	"qi_before" integer NOT NULL,
	"qi_after" integer NOT NULL,
	"source" varchar(64),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_redeem_code_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"redeem_code_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"mail_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_redeem_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"reward_preset_id" varchar(100) NOT NULL,
	"reward_attachments" jsonb,
	"mail_title" varchar(200) NOT NULL,
	"mail_content" text NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"total_limit" integer,
	"claimed_count" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp,
	"ends_at" timestamp,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_reputation_shop_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_library_item_id" varchar(120) NOT NULL,
	"price" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"per_user_limit" integer,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_reputation_shop_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_item_id" uuid NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"item_library_item_id" varchar(120) NOT NULL,
	"quantity" integer NOT NULL,
	"reputation_cost" integer NOT NULL,
	"purchase_week" varchar(10) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_retreat_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"realm" varchar(20) NOT NULL,
	"realm_stage" varchar(10) NOT NULL,
	"years" integer NOT NULL,
	"success" boolean DEFAULT false NOT NULL,
	"chance" double precision NOT NULL,
	"roll" double precision NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"modifiers" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_spiritual_roots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"element" varchar(10) NOT NULL,
	"strength" integer NOT NULL,
	"grade" varchar(20),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_tower_enemy_floors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_key" varchar(40) NOT NULL,
	"realm" varchar(20) NOT NULL,
	"floor" integer NOT NULL,
	"status" varchar(20) DEFAULT 'ready' NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"enemy" jsonb,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"error_message" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_alchemy_formulas" ADD CONSTRAINT "wanjiedaoyou_alchemy_formulas_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_auction_listings" ADD CONSTRAINT "wanjiedaoyou_auction_listings_seller_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_battle_records" ADD CONSTRAINT "wanjiedaoyou_battle_records_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_battle_records" ADD CONSTRAINT "wanjiedaoyou_battle_records_opponent_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("opponent_cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_battle_records_v2" ADD CONSTRAINT "wanjiedaoyou_battle_records_v2_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_battle_records_v2" ADD CONSTRAINT "wanjiedaoyou_battle_records_v2_opponent_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("opponent_cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_bet_battles" ADD CONSTRAINT "wanjiedaoyou_bet_battles_creator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_bet_battles" ADD CONSTRAINT "wanjiedaoyou_bet_battles_challenger_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("challenger_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_bet_battles" ADD CONSTRAINT "wanjiedaoyou_bet_battles_winner_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("winner_cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_bet_battles" ADD CONSTRAINT "wanjiedaoyou_bet_battles_battle_record_id_wanjiedaoyou_battle_records_id_fk" FOREIGN KEY ("battle_record_id") REFERENCES "public"."wanjiedaoyou_battle_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_bet_battles" ADD CONSTRAINT "wanjiedaoyou_bet_battles_battle_record_v2_id_wanjiedaoyou_battle_records_v2_id_fk" FOREIGN KEY ("battle_record_v2_id") REFERENCES "public"."wanjiedaoyou_battle_records_v2"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_breakthrough_history" ADD CONSTRAINT "wanjiedaoyou_breakthrough_history_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_consumables" ADD CONSTRAINT "wanjiedaoyou_consumables_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_creation_products" ADD CONSTRAINT "wanjiedaoyou_creation_products_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivator_state_versions" ADD CONSTRAINT "wanjiedaoyou_cultivator_state_versions_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivator_tasks" ADD CONSTRAINT "wanjiedaoyou_cultivator_tasks_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_dungeon_histories" ADD CONSTRAINT "wanjiedaoyou_dungeon_histories_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_dungeon_runs" ADD CONSTRAINT "wanjiedaoyou_dungeon_runs_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_feedbacks" ADD CONSTRAINT "wanjiedaoyou_feedbacks_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_mails" ADD CONSTRAINT "wanjiedaoyou_mails_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_materials" ADD CONSTRAINT "wanjiedaoyou_materials_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_player_state_events" ADD CONSTRAINT "wanjiedaoyou_player_state_events_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_pre_heaven_fates" ADD CONSTRAINT "wanjiedaoyou_pre_heaven_fates_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_qi_logs" ADD CONSTRAINT "wanjiedaoyou_qi_logs_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_redeem_code_claims" ADD CONSTRAINT "wanjiedaoyou_redeem_code_claims_redeem_code_id_wanjiedaoyou_redeem_codes_id_fk" FOREIGN KEY ("redeem_code_id") REFERENCES "public"."wanjiedaoyou_redeem_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_redeem_code_claims" ADD CONSTRAINT "wanjiedaoyou_redeem_code_claims_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_redeem_code_claims" ADD CONSTRAINT "wanjiedaoyou_redeem_code_claims_mail_id_wanjiedaoyou_mails_id_fk" FOREIGN KEY ("mail_id") REFERENCES "public"."wanjiedaoyou_mails"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_reputation_shop_items" ADD CONSTRAINT "wanjiedaoyou_reputation_shop_items_item_library_item_id_wanjiedaoyou_item_library_item_id_fk" FOREIGN KEY ("item_library_item_id") REFERENCES "public"."wanjiedaoyou_item_library"("item_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_reputation_shop_purchases" ADD CONSTRAINT "wanjiedaoyou_reputation_shop_purchases_shop_item_id_wanjiedaoyou_reputation_shop_items_id_fk" FOREIGN KEY ("shop_item_id") REFERENCES "public"."wanjiedaoyou_reputation_shop_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_reputation_shop_purchases" ADD CONSTRAINT "wanjiedaoyou_reputation_shop_purchases_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_retreat_records" ADD CONSTRAINT "wanjiedaoyou_retreat_records_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_spiritual_roots" ADD CONSTRAINT "wanjiedaoyou_spiritual_roots_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_templates_channel_status_created_idx" ON "wanjiedaoyou_admin_message_templates" USING btree ("channel","status","created_at");--> statement-breakpoint
CREATE INDEX "alchemy_formulas_cultivator_updated_idx" ON "wanjiedaoyou_alchemy_formulas" USING btree ("cultivator_id","updated_at");--> statement-breakpoint
CREATE INDEX "alchemy_formulas_cultivator_family_idx" ON "wanjiedaoyou_alchemy_formulas" USING btree ("cultivator_id","family");--> statement-breakpoint
CREATE INDEX "auction_status_expires_created_idx" ON "wanjiedaoyou_auction_listings" USING btree ("status","expires_at","created_at");--> statement-breakpoint
CREATE INDEX "auction_seller_status_idx" ON "wanjiedaoyou_auction_listings" USING btree ("seller_id","status");--> statement-breakpoint
CREATE INDEX "auction_status_expires_price_idx" ON "wanjiedaoyou_auction_listings" USING btree ("status","expires_at","price");--> statement-breakpoint
CREATE INDEX "auction_status_expires_item_type_idx" ON "wanjiedaoyou_auction_listings" USING btree ("status","expires_at","item_type");--> statement-breakpoint
CREATE INDEX "battle_records_cultivator_created_idx" ON "wanjiedaoyou_battle_records" USING btree ("cultivator_id","created_at");--> statement-breakpoint
CREATE INDEX "battle_records_opponent_created_idx" ON "wanjiedaoyou_battle_records" USING btree ("opponent_cultivator_id","created_at");--> statement-breakpoint
CREATE INDEX "battle_records_v2_cultivator_created_idx" ON "wanjiedaoyou_battle_records_v2" USING btree ("cultivator_id","created_at");--> statement-breakpoint
CREATE INDEX "battle_records_v2_opponent_created_idx" ON "wanjiedaoyou_battle_records_v2" USING btree ("opponent_cultivator_id","created_at");--> statement-breakpoint
CREATE INDEX "battle_records_v2_user_created_idx" ON "wanjiedaoyou_battle_records_v2" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "bet_battles_status_expires_idx" ON "wanjiedaoyou_bet_battles" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "bet_battles_creator_status_idx" ON "wanjiedaoyou_bet_battles" USING btree ("creator_id","status");--> statement-breakpoint
CREATE INDEX "bet_battles_status_created_idx" ON "wanjiedaoyou_bet_battles" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "breakthrough_history_cultivator_created_idx" ON "wanjiedaoyou_breakthrough_history" USING btree ("cultivator_id","created_at");--> statement-breakpoint
CREATE INDEX "consumables_cultivator_idx" ON "wanjiedaoyou_consumables" USING btree ("cultivator_id");--> statement-breakpoint
CREATE INDEX "consumables_cultivator_name_quality_idx" ON "wanjiedaoyou_consumables" USING btree ("cultivator_id","name","quality");--> statement-breakpoint
CREATE INDEX "consumables_score_idx" ON "wanjiedaoyou_consumables" USING btree ("score");--> statement-breakpoint
CREATE INDEX "creation_products_cultivator_type_idx" ON "wanjiedaoyou_creation_products" USING btree ("cultivator_id","product_type");--> statement-breakpoint
CREATE INDEX "creation_products_type_score_idx" ON "wanjiedaoyou_creation_products" USING btree ("product_type","score");--> statement-breakpoint
CREATE INDEX "creation_products_equipped_idx" ON "wanjiedaoyou_creation_products" USING btree ("cultivator_id","is_equipped");--> statement-breakpoint
CREATE INDEX "cultivator_tasks_cultivator_status_updated_idx" ON "wanjiedaoyou_cultivator_tasks" USING btree ("cultivator_id","status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cultivator_tasks_cultivator_definition_unique" ON "wanjiedaoyou_cultivator_tasks" USING btree ("cultivator_id","definition_id");--> statement-breakpoint
CREATE INDEX "cultivators_user_status_updated_idx" ON "wanjiedaoyou_cultivators" USING btree ("user_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "cultivators_status_created_idx" ON "wanjiedaoyou_cultivators" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "dungeon_histories_cultivator_created_idx" ON "wanjiedaoyou_dungeon_histories" USING btree ("cultivator_id","created_at");--> statement-breakpoint
CREATE INDEX "dungeon_runs_cultivator_status_updated_idx" ON "wanjiedaoyou_dungeon_runs" USING btree ("cultivator_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "dungeon_runs_status_updated_idx" ON "wanjiedaoyou_dungeon_runs" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "feedback_user_created_at_idx" ON "wanjiedaoyou_feedbacks" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "feedback_status_type_created_at_idx" ON "wanjiedaoyou_feedbacks" USING btree ("status","type","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "item_library_item_id_unique" ON "wanjiedaoyou_item_library" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "item_library_status_type_idx" ON "wanjiedaoyou_item_library" USING btree ("status","type");--> statement-breakpoint
CREATE INDEX "item_library_name_idx" ON "wanjiedaoyou_item_library" USING btree ("name");--> statement-breakpoint
CREATE INDEX "mails_cultivator_created_idx" ON "wanjiedaoyou_mails" USING btree ("cultivator_id","created_at");--> statement-breakpoint
CREATE INDEX "mails_cultivator_is_read_created_idx" ON "wanjiedaoyou_mails" USING btree ("cultivator_id","is_read","created_at");--> statement-breakpoint
CREATE INDEX "materials_cultivator_idx" ON "wanjiedaoyou_materials" USING btree ("cultivator_id");--> statement-breakpoint
CREATE INDEX "materials_cultivator_name_idx" ON "wanjiedaoyou_materials" USING btree ("cultivator_id","name");--> statement-breakpoint
CREATE INDEX "materials_cultivator_name_rank_idx" ON "wanjiedaoyou_materials" USING btree ("cultivator_id","name","rank");--> statement-breakpoint
CREATE INDEX "player_state_events_cultivator_version_idx" ON "wanjiedaoyou_player_state_events" USING btree ("cultivator_id","global_version","id");--> statement-breakpoint
CREATE INDEX "player_state_events_user_idx" ON "wanjiedaoyou_player_state_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "player_state_events_created_idx" ON "wanjiedaoyou_player_state_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "pre_heaven_fates_cultivator_idx" ON "wanjiedaoyou_pre_heaven_fates" USING btree ("cultivator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "qi_logs_action_instance_uidx" ON "wanjiedaoyou_qi_logs" USING btree ("action_instance_id");--> statement-breakpoint
CREATE INDEX "qi_logs_cultivator_created_idx" ON "wanjiedaoyou_qi_logs" USING btree ("cultivator_id","created_at");--> statement-breakpoint
CREATE INDEX "qi_logs_status_created_idx" ON "wanjiedaoyou_qi_logs" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "redeem_code_claims_code_user_unique" ON "wanjiedaoyou_redeem_code_claims" USING btree ("redeem_code_id","user_id");--> statement-breakpoint
CREATE INDEX "redeem_code_claims_user_idx" ON "wanjiedaoyou_redeem_code_claims" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "redeem_code_claims_code_idx" ON "wanjiedaoyou_redeem_code_claims" USING btree ("redeem_code_id");--> statement-breakpoint
CREATE UNIQUE INDEX "redeem_codes_code_unique" ON "wanjiedaoyou_redeem_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "redeem_codes_status_created_idx" ON "wanjiedaoyou_redeem_codes" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "redeem_codes_created_idx" ON "wanjiedaoyou_redeem_codes" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reputation_shop_item_library_item_uidx" ON "wanjiedaoyou_reputation_shop_items" USING btree ("item_library_item_id");--> statement-breakpoint
CREATE INDEX "reputation_shop_status_sort_idx" ON "wanjiedaoyou_reputation_shop_items" USING btree ("status","sort_order","updated_at");--> statement-breakpoint
CREATE INDEX "reputation_shop_purchases_cultivator_item_idx" ON "wanjiedaoyou_reputation_shop_purchases" USING btree ("cultivator_id","shop_item_id");--> statement-breakpoint
CREATE INDEX "reputation_shop_purchases_week_idx" ON "wanjiedaoyou_reputation_shop_purchases" USING btree ("cultivator_id","shop_item_id","purchase_week");--> statement-breakpoint
CREATE INDEX "reputation_shop_purchases_created_idx" ON "wanjiedaoyou_reputation_shop_purchases" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "retreat_records_cultivator_timestamp_idx" ON "wanjiedaoyou_retreat_records" USING btree ("cultivator_id","timestamp");--> statement-breakpoint
CREATE INDEX "spiritual_roots_cultivator_idx" ON "wanjiedaoyou_spiritual_roots" USING btree ("cultivator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tower_enemy_floors_season_realm_floor_uidx" ON "wanjiedaoyou_tower_enemy_floors" USING btree ("season_key","realm","floor");--> statement-breakpoint
CREATE INDEX "tower_enemy_floors_realm_floor_generated_idx" ON "wanjiedaoyou_tower_enemy_floors" USING btree ("realm","floor","generated_at");--> statement-breakpoint
CREATE INDEX "tower_enemy_floors_season_realm_status_idx" ON "wanjiedaoyou_tower_enemy_floors" USING btree ("season_key","realm","status");