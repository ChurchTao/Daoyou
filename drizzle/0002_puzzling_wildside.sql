CREATE TABLE "wanjiedaoyou_cultivator_friends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"friend_cultivator_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_auction_listings" ADD COLUMN "visibility" varchar(20) DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_auction_listings" ADD COLUMN "target_cultivator_id" uuid;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_auction_listings" ADD COLUMN "target_cultivator_name" varchar(100);--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivator_friends" ADD CONSTRAINT "wanjiedaoyou_cultivator_friends_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivator_friends" ADD CONSTRAINT "wanjiedaoyou_cultivator_friends_friend_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("friend_cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cultivator_friends_pair_uidx" ON "wanjiedaoyou_cultivator_friends" USING btree ("cultivator_id","friend_cultivator_id");--> statement-breakpoint
CREATE INDEX "cultivator_friends_friend_idx" ON "wanjiedaoyou_cultivator_friends" USING btree ("friend_cultivator_id");--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_auction_listings" ADD CONSTRAINT "wanjiedaoyou_auction_listings_target_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("target_cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auction_visibility_target_status_idx" ON "wanjiedaoyou_auction_listings" USING btree ("visibility","target_cultivator_id","status");