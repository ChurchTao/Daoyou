CREATE TABLE "wanjiedaoyou_dungeon_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"map_node_id" varchar(100) NOT NULL,
	"status" varchar(20) DEFAULT 'ACTIVE' NOT NULL,
	"current_layer" integer DEFAULT 1 NOT NULL,
	"max_layer" integer DEFAULT 10 NOT NULL,
	"danger_score" integer DEFAULT 10 NOT NULL,
	"run_state" jsonb NOT NULL,
	"granted_gains" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_dungeon_runs" ADD CONSTRAINT "wanjiedaoyou_dungeon_runs_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dungeon_runs_cultivator_status_updated_idx" ON "wanjiedaoyou_dungeon_runs" USING btree ("cultivator_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "dungeon_runs_status_updated_idx" ON "wanjiedaoyou_dungeon_runs" USING btree ("status","updated_at");