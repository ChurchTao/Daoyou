ALTER TABLE "wanjiedaoyou_auction_listings" ADD COLUMN "item_name" varchar(200) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_auction_listings" ADD COLUMN "item_quality" varchar(20) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_auction_listings" ADD COLUMN "item_category" varchar(50) DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX "auction_status_type_expires_created_idx" ON "wanjiedaoyou_auction_listings" USING btree ("status","item_type","expires_at","created_at");--> statement-breakpoint
CREATE INDEX "auction_status_type_category_expires_created_idx" ON "wanjiedaoyou_auction_listings" USING btree ("status","item_type","item_category","expires_at","created_at");--> statement-breakpoint
CREATE INDEX "auction_status_type_quality_expires_created_idx" ON "wanjiedaoyou_auction_listings" USING btree ("status","item_type","item_quality","expires_at","created_at");--> statement-breakpoint
CREATE INDEX "auction_status_item_name_expires_created_idx" ON "wanjiedaoyou_auction_listings" USING btree ("status","item_name","expires_at","created_at");--> statement-breakpoint
CREATE INDEX "auction_status_seller_name_expires_created_idx" ON "wanjiedaoyou_auction_listings" USING btree ("status","seller_name","expires_at","created_at");