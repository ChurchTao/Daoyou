ALTER TABLE "wanjiedaoyou_cultivators" ADD COLUMN "status" varchar(20) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivators" ADD COLUMN "died_at" timestamp;