CREATE TABLE "wanjiedaoyou_auction_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"seller_name" varchar(100) NOT NULL,
	"item_type" varchar(20) NOT NULL,
	"item_id" uuid NOT NULL,
	"item_snapshot" jsonb NOT NULL,
	"price" integer NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"sold_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_auction_listings" ADD CONSTRAINT "wanjiedaoyou_auction_listings_seller_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auction_status_expires_idx" ON "wanjiedaoyou_auction_listings" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "auction_seller_status_idx" ON "wanjiedaoyou_auction_listings" USING btree ("seller_id","status");--> statement-breakpoint
CREATE INDEX "auction_item_type_idx" ON "wanjiedaoyou_auction_listings" USING btree ("item_type");