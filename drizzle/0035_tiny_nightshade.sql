CREATE TABLE "wanjiedaoyou_creation_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"product_type" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"element" varchar(10),
	"quality" varchar(20),
	"slot" varchar(20),
	"score" integer DEFAULT 0 NOT NULL,
	"is_equipped" boolean DEFAULT false NOT NULL,
	"ability_config" jsonb NOT NULL,
	"product_model" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_creation_products" ADD CONSTRAINT "wanjiedaoyou_creation_products_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "creation_products_cultivator_type_idx" ON "wanjiedaoyou_creation_products" USING btree ("cultivator_id","product_type");--> statement-breakpoint
CREATE INDEX "creation_products_type_score_idx" ON "wanjiedaoyou_creation_products" USING btree ("product_type","score");--> statement-breakpoint
CREATE INDEX "creation_products_equipped_idx" ON "wanjiedaoyou_creation_products" USING btree ("cultivator_id","is_equipped");