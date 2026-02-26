CREATE TABLE "wanjiedaoyou_bet_battles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"creator_name" varchar(100) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"min_realm" varchar(20) NOT NULL,
	"max_realm" varchar(20) NOT NULL,
	"creator_stake_snapshot" jsonb NOT NULL,
	"challenger_stake_snapshot" jsonb,
	"challenger_id" uuid,
	"challenger_name" varchar(100),
	"winner_cultivator_id" uuid,
	"battle_record_id" uuid,
	"expires_at" timestamp NOT NULL,
	"matched_at" timestamp,
	"settled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_bet_battles" ADD CONSTRAINT "wanjiedaoyou_bet_battles_creator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_bet_battles" ADD CONSTRAINT "wanjiedaoyou_bet_battles_challenger_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("challenger_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_bet_battles" ADD CONSTRAINT "wanjiedaoyou_bet_battles_winner_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("winner_cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_bet_battles" ADD CONSTRAINT "wanjiedaoyou_bet_battles_battle_record_id_wanjiedaoyou_battle_records_id_fk" FOREIGN KEY ("battle_record_id") REFERENCES "public"."wanjiedaoyou_battle_records"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bet_battles_status_expires_idx" ON "wanjiedaoyou_bet_battles" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "bet_battles_creator_status_idx" ON "wanjiedaoyou_bet_battles" USING btree ("creator_id","status");--> statement-breakpoint
CREATE INDEX "bet_battles_status_created_idx" ON "wanjiedaoyou_bet_battles" USING btree ("status","created_at");