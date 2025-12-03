ALTER TABLE "wanjiedaoyou_cultivation_techniques" ADD COLUMN "grade" varchar(20);--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_pre_heaven_fates" ADD COLUMN "quality" varchar(10);--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_skills" ADD COLUMN "grade" varchar(20);--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_spiritual_roots" ADD COLUMN "grade" varchar(20);--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_temp_cultivators" ADD COLUMN "available_fates" jsonb;