CREATE TABLE "wanjiedaoyou_battle_records_v2" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"battle_type" varchar(20) DEFAULT 'normal' NOT NULL,
	"opponent_cultivator_id" uuid,
	"engine_version" varchar(40) DEFAULT 'battle-v5' NOT NULL,
	"result_version" integer DEFAULT 2 NOT NULL,
	"battle_result" jsonb NOT NULL,
	"battle_report" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_bet_battles" ADD COLUMN "battle_record_v2_id" uuid;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_battle_records_v2" ADD CONSTRAINT "wanjiedaoyou_battle_records_v2_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_battle_records_v2" ADD CONSTRAINT "wanjiedaoyou_battle_records_v2_opponent_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("opponent_cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "battle_records_v2_cultivator_created_idx" ON "wanjiedaoyou_battle_records_v2" USING btree ("cultivator_id","created_at");--> statement-breakpoint
CREATE INDEX "battle_records_v2_opponent_created_idx" ON "wanjiedaoyou_battle_records_v2" USING btree ("opponent_cultivator_id","created_at");--> statement-breakpoint
CREATE INDEX "battle_records_v2_user_created_idx" ON "wanjiedaoyou_battle_records_v2" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_bet_battles" ADD CONSTRAINT "wanjiedaoyou_bet_battles_battle_record_v2_id_wanjiedaoyou_battle_records_v2_id_fk" FOREIGN KEY ("battle_record_v2_id") REFERENCES "public"."wanjiedaoyou_battle_records_v2"("id") ON DELETE set null ON UPDATE no action;