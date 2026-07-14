CREATE TABLE "wanjiedaoyou_sect_path_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_id" uuid NOT NULL,
	"path_id" varchar(64) NOT NULL,
	"level" integer DEFAULT 0 NOT NULL,
	"tactic_id" varchar(32) NOT NULL,
	"active_meridian_slot" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "sect_memberships_cultivator_unique";--> statement-breakpoint
DROP INDEX "sect_meridian_membership_slot_unique";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_memberships" ALTER COLUMN "config_version" SET DEFAULT 2;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_memberships" ADD COLUMN "active_path_id" varchar(64);--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_meridian_loadouts" ADD COLUMN "path_id" varchar(64) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_path_progress" ADD CONSTRAINT "wanjiedaoyou_sect_path_progress_membership_id_wanjiedaoyou_sect_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."wanjiedaoyou_sect_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sect_path_membership_path_unique" ON "wanjiedaoyou_sect_path_progress" USING btree ("membership_id","path_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sect_memberships_cultivator_sect_unique" ON "wanjiedaoyou_sect_memberships" USING btree ("cultivator_id","sect_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sect_memberships_active_cultivator_unique" ON "wanjiedaoyou_sect_memberships" USING btree ("cultivator_id") WHERE "wanjiedaoyou_sect_memberships"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "sect_meridian_membership_path_slot_unique" ON "wanjiedaoyou_sect_meridian_loadouts" USING btree ("membership_id","path_id","slot");--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_memberships" DROP COLUMN "path_id";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_memberships" DROP COLUMN "tactic_id";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_memberships" DROP COLUMN "active_meridian_slot";