CREATE TABLE "wanjiedaoyou_wild_searches" (
	"cultivator_id" uuid PRIMARY KEY NOT NULL,
	"encounter" jsonb NOT NULL,
	"prepared_battle" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_wild_searches" ADD CONSTRAINT "wanjiedaoyou_wild_searches_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;