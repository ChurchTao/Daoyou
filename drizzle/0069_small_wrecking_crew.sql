ALTER TABLE "wanjiedaoyou_auction_buy_orders" ALTER COLUMN "target_stack_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_auction_buy_orders" ALTER COLUMN "target_snapshot" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_auction_buy_orders" ADD COLUMN "target_mode" varchar(20) DEFAULT 'exact' NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_auction_buy_orders" ADD COLUMN "target_conditions" jsonb;