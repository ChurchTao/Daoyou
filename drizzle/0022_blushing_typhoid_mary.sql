ALTER TABLE "wanjiedaoyou_artifacts" ADD COLUMN "effects" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_consumables" ADD COLUMN "effects" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivation_techniques" ADD COLUMN "effects" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_pre_heaven_fates" ADD COLUMN "effects" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_skills" ADD COLUMN "effects" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_artifacts" DROP COLUMN "bonus";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_artifacts" DROP COLUMN "special_effects";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_artifacts" DROP COLUMN "curses";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_artifacts" DROP COLUMN "passive_traits";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_consumables" DROP COLUMN "effect";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivation_techniques" DROP COLUMN "bonus";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivation_techniques" DROP COLUMN "passive_traits";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_pre_heaven_fates" DROP COLUMN "type";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_pre_heaven_fates" DROP COLUMN "attribute_mod";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_skills" DROP COLUMN "type";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_skills" DROP COLUMN "power";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_skills" DROP COLUMN "effect";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_skills" DROP COLUMN "duration";