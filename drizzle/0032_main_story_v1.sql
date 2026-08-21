CREATE TABLE IF NOT EXISTS "wanjiedaoyou_story_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"story_id" varchar(80) NOT NULL,
	"story_version" integer DEFAULT 1 NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"current_node_id" varchar(40) NOT NULL,
	"current_step" varchar(80) NOT NULL,
	"flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"npc_trust" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wanjiedaoyou_story_event_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"story_id" varchar(80) NOT NULL,
	"story_version" integer DEFAULT 1 NOT NULL,
	"node_id" varchar(40) NOT NULL,
	"scene_key" varchar(120),
	"event_type" varchar(60) NOT NULL,
	"choice_id" varchar(80),
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dedupe_key" varchar(160) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_story_progress" ADD CONSTRAINT "wanjiedaoyou_story_progress_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_story_event_logs" ADD CONSTRAINT "wanjiedaoyou_story_event_logs_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "story_progress_cultivator_story_uidx" ON "wanjiedaoyou_story_progress" USING btree ("cultivator_id","story_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "story_progress_cultivator_status_updated_idx" ON "wanjiedaoyou_story_progress" USING btree ("cultivator_id","status","updated_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "story_event_logs_cultivator_dedupe_uidx" ON "wanjiedaoyou_story_event_logs" USING btree ("cultivator_id","dedupe_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "story_event_logs_cultivator_story_created_idx" ON "wanjiedaoyou_story_event_logs" USING btree ("cultivator_id","story_id","created_at");
