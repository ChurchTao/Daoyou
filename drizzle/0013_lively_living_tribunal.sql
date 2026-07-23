CREATE TABLE "wanjiedaoyou_sect_construction_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sect_id" varchar(64) NOT NULL,
	"facility_key" varchar(32) NOT NULL,
	"target_level" integer NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"target" integer NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"started_week_key" varchar(10) NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_sect_contribution_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"source" varchar(32) NOT NULL,
	"reference_id" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_sect_donation_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"date_key" varchar(10) NOT NULL,
	"demand_id" varchar(64) NOT NULL,
	"contribution" integer NOT NULL,
	"construction_points" integer NOT NULL,
	"item_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"request_id" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_sect_facilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sect_id" varchar(64) NOT NULL,
	"facility_key" varchar(32) NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_sect_shop_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_id" uuid NOT NULL,
	"week_key" varchar(10) NOT NULL,
	"item_id" varchar(64) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"request_id" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_sect_stipend_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_id" uuid NOT NULL,
	"week_key" varchar(10) NOT NULL,
	"spirit_stones" integer NOT NULL,
	"rewards" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"claimed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_sect_task_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_id" uuid NOT NULL,
	"task_id" varchar(64) NOT NULL,
	"kind" varchar(16) NOT NULL,
	"period_key" varchar(16) NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"completed_at" timestamp,
	"claimed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_memberships" ADD COLUMN "disciple_rank" varchar(16) DEFAULT 'registered' NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_memberships" ADD COLUMN "office" varchar(16) DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_memberships" ADD COLUMN "promoted_at" timestamp;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_contribution_ledger" ADD CONSTRAINT "wanjiedaoyou_sect_contribution_ledger_membership_id_wanjiedaoyou_sect_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."wanjiedaoyou_sect_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_donation_ledger" ADD CONSTRAINT "wanjiedaoyou_sect_donation_ledger_membership_id_wanjiedaoyou_sect_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."wanjiedaoyou_sect_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_donation_ledger" ADD CONSTRAINT "wanjiedaoyou_sect_donation_ledger_project_id_wanjiedaoyou_sect_construction_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."wanjiedaoyou_sect_construction_projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_shop_purchases" ADD CONSTRAINT "wanjiedaoyou_sect_shop_purchases_membership_id_wanjiedaoyou_sect_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."wanjiedaoyou_sect_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_stipend_claims" ADD CONSTRAINT "wanjiedaoyou_sect_stipend_claims_membership_id_wanjiedaoyou_sect_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."wanjiedaoyou_sect_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_task_records" ADD CONSTRAINT "wanjiedaoyou_sect_task_records_membership_id_wanjiedaoyou_sect_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."wanjiedaoyou_sect_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sect_projects_active_sect_unique" ON "wanjiedaoyou_sect_construction_projects" USING btree ("sect_id") WHERE "wanjiedaoyou_sect_construction_projects"."status" = 'active';--> statement-breakpoint
CREATE INDEX "sect_projects_sect_created_idx" ON "wanjiedaoyou_sect_construction_projects" USING btree ("sect_id","created_at");--> statement-breakpoint
CREATE INDEX "sect_contribution_membership_created_idx" ON "wanjiedaoyou_sect_contribution_ledger" USING btree ("membership_id","created_at");--> statement-breakpoint
CREATE INDEX "sect_donation_member_date_idx" ON "wanjiedaoyou_sect_donation_ledger" USING btree ("membership_id","date_key");--> statement-breakpoint
CREATE UNIQUE INDEX "sect_donation_member_request_unique" ON "wanjiedaoyou_sect_donation_ledger" USING btree ("membership_id","request_id") WHERE "wanjiedaoyou_sect_donation_ledger"."request_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "sect_facilities_sect_key_unique" ON "wanjiedaoyou_sect_facilities" USING btree ("sect_id","facility_key");--> statement-breakpoint
CREATE INDEX "sect_shop_member_week_item_idx" ON "wanjiedaoyou_sect_shop_purchases" USING btree ("membership_id","week_key","item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sect_shop_member_request_unique" ON "wanjiedaoyou_sect_shop_purchases" USING btree ("membership_id","request_id") WHERE "wanjiedaoyou_sect_shop_purchases"."request_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "sect_stipend_member_week_unique" ON "wanjiedaoyou_sect_stipend_claims" USING btree ("membership_id","week_key");--> statement-breakpoint
CREATE UNIQUE INDEX "sect_task_membership_period_task_unique" ON "wanjiedaoyou_sect_task_records" USING btree ("membership_id","period_key","task_id");--> statement-breakpoint
CREATE INDEX "sect_task_membership_kind_period_idx" ON "wanjiedaoyou_sect_task_records" USING btree ("membership_id","kind","period_key");