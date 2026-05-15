CREATE TABLE "wanjiedaoyou_alchemy_formulas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"family" varchar(20) NOT NULL,
	"pattern" jsonb NOT NULL,
	"blueprint" jsonb NOT NULL,
	"mastery" jsonb DEFAULT '{"level":0,"exp":0}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_alchemy_formulas" ADD CONSTRAINT "wanjiedaoyou_alchemy_formulas_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alchemy_formulas_cultivator_updated_idx" ON "wanjiedaoyou_alchemy_formulas" USING btree ("cultivator_id","updated_at");--> statement-breakpoint
CREATE INDEX "alchemy_formulas_cultivator_family_idx" ON "wanjiedaoyou_alchemy_formulas" USING btree ("cultivator_id","family");