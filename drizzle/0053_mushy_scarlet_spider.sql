CREATE TABLE "wanjiedaoyou_reputation_shop_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_library_item_id" varchar(120) NOT NULL,
	"price" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"per_user_limit" integer,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_reputation_shop_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_item_id" uuid NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"item_library_item_id" varchar(120) NOT NULL,
	"quantity" integer NOT NULL,
	"reputation_cost" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivators" ADD COLUMN "reputation" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_reputation_shop_items" ADD CONSTRAINT "wanjiedaoyou_reputation_shop_items_item_library_item_id_wanjiedaoyou_item_library_item_id_fk" FOREIGN KEY ("item_library_item_id") REFERENCES "public"."wanjiedaoyou_item_library"("item_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_reputation_shop_purchases" ADD CONSTRAINT "wanjiedaoyou_reputation_shop_purchases_shop_item_id_wanjiedaoyou_reputation_shop_items_id_fk" FOREIGN KEY ("shop_item_id") REFERENCES "public"."wanjiedaoyou_reputation_shop_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_reputation_shop_purchases" ADD CONSTRAINT "wanjiedaoyou_reputation_shop_purchases_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reputation_shop_item_library_item_uidx" ON "wanjiedaoyou_reputation_shop_items" USING btree ("item_library_item_id");--> statement-breakpoint
CREATE INDEX "reputation_shop_status_sort_idx" ON "wanjiedaoyou_reputation_shop_items" USING btree ("status","sort_order","updated_at");--> statement-breakpoint
CREATE INDEX "reputation_shop_purchases_cultivator_item_idx" ON "wanjiedaoyou_reputation_shop_purchases" USING btree ("cultivator_id","shop_item_id");--> statement-breakpoint
CREATE INDEX "reputation_shop_purchases_created_idx" ON "wanjiedaoyou_reputation_shop_purchases" USING btree ("created_at");