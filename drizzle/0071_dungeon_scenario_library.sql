CREATE TABLE "wanjiedaoyou_dungeon_scenario_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"map_node_id" varchar(100) NOT NULL,
	"template_id" varchar(60) NOT NULL,
	"status" varchar(20) DEFAULT 'queued' NOT NULL,
	"reason" varchar(20) NOT NULL,
	"requested_by" uuid,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"scenario_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_dungeon_scenario_plays" (
	"cultivator_id" uuid NOT NULL,
	"scenario_id" uuid NOT NULL,
	"map_node_id" varchar(100) NOT NULL,
	"template_id" varchar(60) NOT NULL,
	"play_count" integer DEFAULT 1 NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"best_total" integer,
	"first_played_at" timestamp DEFAULT now() NOT NULL,
	"last_played_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wanjiedaoyou_dungeon_scenario_plays_cultivator_id_scenario_id_pk" PRIMARY KEY("cultivator_id","scenario_id")
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_dungeon_scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"map_node_id" varchar(100) NOT NULL,
	"template_id" varchar(60) NOT NULL,
	"title" varchar(60) NOT NULL,
	"case_file" jsonb NOT NULL,
	"source" varchar(20) NOT NULL,
	"generator_version" integer NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"review_issue_count" integer DEFAULT 0 NOT NULL,
	"generation" jsonb,
	"play_count" integer DEFAULT 0 NOT NULL,
	"completion_count" integer DEFAULT 0 NOT NULL,
	"score_sum" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"retired_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_dungeon_scenario_plays" ADD CONSTRAINT "wanjiedaoyou_dungeon_scenario_plays_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_dungeon_scenario_plays" ADD CONSTRAINT "wanjiedaoyou_dungeon_scenario_plays_scenario_id_wanjiedaoyou_dungeon_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."wanjiedaoyou_dungeon_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dungeon_scenario_jobs_slot_pending_unique" ON "wanjiedaoyou_dungeon_scenario_jobs" USING btree ("map_node_id","template_id") WHERE "wanjiedaoyou_dungeon_scenario_jobs"."status" in ('queued', 'running');--> statement-breakpoint
CREATE INDEX "dungeon_scenario_jobs_status_created_idx" ON "wanjiedaoyou_dungeon_scenario_jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "dungeon_scenario_jobs_slot_finished_idx" ON "wanjiedaoyou_dungeon_scenario_jobs" USING btree ("map_node_id","template_id","status","finished_at");--> statement-breakpoint
CREATE INDEX "dungeon_scenario_plays_cultivator_node_idx" ON "wanjiedaoyou_dungeon_scenario_plays" USING btree ("cultivator_id","map_node_id");--> statement-breakpoint
CREATE INDEX "dungeon_scenarios_slot_status_idx" ON "wanjiedaoyou_dungeon_scenarios" USING btree ("map_node_id","template_id","status");