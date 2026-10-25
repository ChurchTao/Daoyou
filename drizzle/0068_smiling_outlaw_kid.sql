CREATE TABLE "wanjiedaoyou_auction_buy_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_id" uuid NOT NULL,
	"buyer_name" varchar(100) NOT NULL,
	"item_type" varchar(20) NOT NULL,
	"item_name" varchar(200) DEFAULT '' NOT NULL,
	"item_quality" varchar(20) DEFAULT '' NOT NULL,
	"item_category" varchar(50) DEFAULT '' NOT NULL,
	"target_definition_id" varchar(160) NOT NULL,
	"target_stack_key" varchar(200) NOT NULL,
	"target_snapshot" jsonb NOT NULL,
	"price" integer NOT NULL,
	"initial_quantity" integer NOT NULL,
	"remaining_quantity" integer NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"filled_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_auction_buy_orders" ADD CONSTRAINT "wanjiedaoyou_auction_buy_orders_buyer_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auction_buy_order_status_expires_price_idx" ON "wanjiedaoyou_auction_buy_orders" USING btree ("status","expires_at","price");--> statement-breakpoint
CREATE INDEX "auction_buy_order_status_expires_created_idx" ON "wanjiedaoyou_auction_buy_orders" USING btree ("status","expires_at","created_at");--> statement-breakpoint
CREATE INDEX "auction_buy_order_status_type_expires_created_idx" ON "wanjiedaoyou_auction_buy_orders" USING btree ("status","item_type","expires_at","created_at");--> statement-breakpoint
CREATE INDEX "auction_buy_order_status_name_expires_created_idx" ON "wanjiedaoyou_auction_buy_orders" USING btree ("status","item_name","expires_at","created_at");--> statement-breakpoint
CREATE INDEX "auction_buy_order_buyer_status_idx" ON "wanjiedaoyou_auction_buy_orders" USING btree ("buyer_id","status");