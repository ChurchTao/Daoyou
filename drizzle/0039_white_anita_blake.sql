ALTER TABLE "wanjiedaoyou_cultivators" ADD COLUMN "condition" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivators" DROP COLUMN "persistent_statuses";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivators" DROP COLUMN "persistent_state";