CREATE TABLE "wanjiedaoyou_item_library" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" varchar(120) NOT NULL,
	"type" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'published' NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"quality" varchar(20),
	"element" varchar(10),
	"category" varchar(40),
	"payload" jsonb NOT NULL,
	"editor_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "wanjiedaoyou_artifacts" CASCADE;--> statement-breakpoint
DROP TABLE "wanjiedaoyou_cultivation_techniques" CASCADE;--> statement-breakpoint
DROP TABLE "wanjiedaoyou_equipped_items" CASCADE;--> statement-breakpoint
DROP TABLE "wanjiedaoyou_skills" CASCADE;--> statement-breakpoint
CREATE UNIQUE INDEX "item_library_item_id_unique" ON "wanjiedaoyou_item_library" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "item_library_status_type_idx" ON "wanjiedaoyou_item_library" USING btree ("status","type");--> statement-breakpoint
CREATE INDEX "item_library_name_idx" ON "wanjiedaoyou_item_library" USING btree ("name");