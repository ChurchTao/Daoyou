ALTER TABLE "wanjiedaoyou_artifacts" ADD COLUMN "prompt" varchar(200) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_artifacts" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_consumables" ADD COLUMN "prompt" varchar(200) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_consumables" ADD COLUMN "quality" varchar(20) DEFAULT '凡品' NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_consumables" ADD COLUMN "description" text;