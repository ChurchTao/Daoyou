CREATE TABLE IF NOT EXISTS "wanjiedaoyou_spirit_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"level" integer DEFAULT 0 NOT NULL,
	"self_harvest_count" integer DEFAULT 0 NOT NULL,
	"total_care_count" integer DEFAULT 0 NOT NULL,
	"starter_claimed" boolean DEFAULT false NOT NULL,
	"proficiency" integer DEFAULT 0 NOT NULL,
	"plots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_spirit_fields" ADD CONSTRAINT "wanjiedaoyou_spirit_fields_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "spirit_fields_cultivator_uidx" ON "wanjiedaoyou_spirit_fields" USING btree ("cultivator_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "spirit_fields_updated_idx" ON "wanjiedaoyou_spirit_fields" USING btree ("updated_at");
