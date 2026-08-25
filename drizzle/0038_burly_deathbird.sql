CREATE TABLE "wanjiedaoyou_story_activity_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"root_activity_id" varchar(160) NOT NULL,
	"decision" varchar(32) NOT NULL,
	"priority" integer NOT NULL,
	"thread_scope" varchar(16),
	"source_event_id" uuid NOT NULL,
	"intent_id" uuid,
	"status" varchar(24) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
DROP INDEX "story_threads_one_open_per_cultivator_uidx";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_story_states" ADD COLUMN "active_sect_thread_id" uuid;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_story_states" ADD COLUMN "sect_cooldown_until" timestamp;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_story_threads" ADD COLUMN "thread_scope" varchar(16) DEFAULT 'personal' NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_story_activity_decisions" ADD CONSTRAINT "wanjiedaoyou_story_activity_decisions_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_story_activity_decisions" ADD CONSTRAINT "wanjiedaoyou_story_activity_decisions_intent_id_wanjiedaoyou_story_intents_id_fk" FOREIGN KEY ("intent_id") REFERENCES "public"."wanjiedaoyou_story_intents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "story_activity_decisions_cultivator_root_uidx" ON "wanjiedaoyou_story_activity_decisions" USING btree ("cultivator_id","root_activity_id");--> statement-breakpoint
CREATE INDEX "story_activity_decisions_cultivator_status_idx" ON "wanjiedaoyou_story_activity_decisions" USING btree ("cultivator_id","status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "story_threads_one_open_per_cultivator_scope_uidx" ON "wanjiedaoyou_story_threads" USING btree ("cultivator_id","thread_scope") WHERE "wanjiedaoyou_story_threads"."status" in ('active', 'paused');