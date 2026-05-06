ALTER TABLE "wanjiedaoyou_consumables" ADD COLUMN "category" varchar(40);--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_consumables" ADD COLUMN "mechanic_key" varchar(100);--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_consumables" ADD COLUMN "quota_kind" varchar(40);--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_consumables" ADD COLUMN "use_spec" jsonb;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivators" ADD COLUMN "persistent_state" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_pre_heaven_fates" ADD COLUMN "registry_key" varchar(100);--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_pre_heaven_fates" ADD COLUMN "details" jsonb DEFAULT '{}'::jsonb;