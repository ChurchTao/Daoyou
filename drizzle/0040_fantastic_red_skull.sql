ALTER TABLE "wanjiedaoyou_consumables" ADD COLUMN "spec" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_consumables" DROP COLUMN "category";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_consumables" DROP COLUMN "effects";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_consumables" DROP COLUMN "mechanic_key";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_consumables" DROP COLUMN "quota_kind";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_consumables" DROP COLUMN "use_spec";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_consumables" DROP COLUMN "details";