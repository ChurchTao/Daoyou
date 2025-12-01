DROP TABLE "wanjiedaoyou_temp_battle_profiles" CASCADE;--> statement-breakpoint
DROP TABLE "wanjiedaoyou_temp_equipment" CASCADE;--> statement-breakpoint
DROP TABLE "wanjiedaoyou_temp_pre_heaven_fates" CASCADE;--> statement-breakpoint
DROP TABLE "wanjiedaoyou_temp_skills" CASCADE;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_temp_cultivators" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_temp_cultivators" ADD COLUMN "cultivator_data" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_temp_cultivators" DROP COLUMN "session_id";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_temp_cultivators" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_temp_cultivators" DROP COLUMN "prompt";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_temp_cultivators" DROP COLUMN "cultivation_level";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_temp_cultivators" DROP COLUMN "spirit_root";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_temp_cultivators" DROP COLUMN "appearance";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_temp_cultivators" DROP COLUMN "backstory";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_temp_cultivators" DROP COLUMN "gender";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_temp_cultivators" DROP COLUMN "origin";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_temp_cultivators" DROP COLUMN "personality";