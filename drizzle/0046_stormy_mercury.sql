CREATE TABLE "wanjiedaoyou_dungeon_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"map_node_id" varchar(100) NOT NULL,
	"status" varchar(30) DEFAULT 'EXPLORING' NOT NULL,
	"current_round" integer DEFAULT 1 NOT NULL,
	"max_rounds" integer DEFAULT 5 NOT NULL,
	"danger_score" integer DEFAULT 10 NOT NULL,
	"run_state" jsonb NOT NULL,
	"cost_ledger" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"gain_ledger" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pending_action" jsonb,
	"active_battle_id" uuid,
	"battle_payload" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_dungeon_runs" ADD CONSTRAINT "wanjiedaoyou_dungeon_runs_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dungeon_runs_cultivator_status_updated_idx" ON "wanjiedaoyou_dungeon_runs" USING btree ("cultivator_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "dungeon_runs_status_updated_idx" ON "wanjiedaoyou_dungeon_runs" USING btree ("status","updated_at");