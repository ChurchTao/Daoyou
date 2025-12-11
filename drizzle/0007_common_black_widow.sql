CREATE TABLE "wanjiedaoyou_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(20) NOT NULL,
	"rank" varchar(20) NOT NULL,
	"element" varchar(10),
	"description" text,
	"details" jsonb DEFAULT '{}'::jsonb,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivators" ADD COLUMN "spirit_stones" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_materials" ADD CONSTRAINT "wanjiedaoyou_materials_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;