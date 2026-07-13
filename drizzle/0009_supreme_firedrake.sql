CREATE TABLE "wanjiedaoyou_sect_ability_loadouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_id" uuid NOT NULL,
	"slot" integer NOT NULL,
	"ability_id" varchar(64) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_sect_daily_commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_id" uuid NOT NULL,
	"date_key" varchar(10) NOT NULL,
	"completion_type" varchar(16) NOT NULL,
	"completed_at" timestamp NOT NULL,
	"claimed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_sect_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"sect_id" varchar(64) NOT NULL,
	"status" varchar(16) DEFAULT 'prospect' NOT NULL,
	"experienced_at" timestamp,
	"joined_at" timestamp,
	"path_id" varchar(64),
	"contribution" integer DEFAULT 0 NOT NULL,
	"tactic_id" varchar(32) DEFAULT 'steady' NOT NULL,
	"active_meridian_slot" integer DEFAULT 1 NOT NULL,
	"config_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_sect_meridian_loadouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_id" uuid NOT NULL,
	"slot" integer NOT NULL,
	"node_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_sect_method_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_id" uuid NOT NULL,
	"method_id" varchar(64) NOT NULL,
	"level" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivator_state_versions" ADD COLUMN "sect_version" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivators" ADD COLUMN "player_race" varchar(32) DEFAULT 'human' NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivators" ADD COLUMN "race_narrative" text;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_ability_loadouts" ADD CONSTRAINT "wanjiedaoyou_sect_ability_loadouts_membership_id_wanjiedaoyou_sect_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."wanjiedaoyou_sect_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_daily_commissions" ADD CONSTRAINT "wanjiedaoyou_sect_daily_commissions_membership_id_wanjiedaoyou_sect_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."wanjiedaoyou_sect_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_memberships" ADD CONSTRAINT "wanjiedaoyou_sect_memberships_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_meridian_loadouts" ADD CONSTRAINT "wanjiedaoyou_sect_meridian_loadouts_membership_id_wanjiedaoyou_sect_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."wanjiedaoyou_sect_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_method_progress" ADD CONSTRAINT "wanjiedaoyou_sect_method_progress_membership_id_wanjiedaoyou_sect_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."wanjiedaoyou_sect_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sect_ability_membership_slot_unique" ON "wanjiedaoyou_sect_ability_loadouts" USING btree ("membership_id","slot");--> statement-breakpoint
CREATE UNIQUE INDEX "sect_ability_membership_ability_unique" ON "wanjiedaoyou_sect_ability_loadouts" USING btree ("membership_id","ability_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sect_commission_membership_date_unique" ON "wanjiedaoyou_sect_daily_commissions" USING btree ("membership_id","date_key");--> statement-breakpoint
CREATE UNIQUE INDEX "sect_memberships_cultivator_unique" ON "wanjiedaoyou_sect_memberships" USING btree ("cultivator_id");--> statement-breakpoint
CREATE INDEX "sect_memberships_sect_status_idx" ON "wanjiedaoyou_sect_memberships" USING btree ("sect_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "sect_meridian_membership_slot_unique" ON "wanjiedaoyou_sect_meridian_loadouts" USING btree ("membership_id","slot");--> statement-breakpoint
CREATE UNIQUE INDEX "sect_method_membership_method_unique" ON "wanjiedaoyou_sect_method_progress" USING btree ("membership_id","method_id");