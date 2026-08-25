CREATE TABLE "wanjiedaoyou_story_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"entity_type" varchar(24) NOT NULL,
	"state" text NOT NULL,
	"relationship" varchar(24) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_story_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"story_version" integer NOT NULL,
	"beat_type" varchar(24) NOT NULL,
	"payload" jsonb NOT NULL,
	"requires_choice" boolean DEFAULT false NOT NULL,
	"status" varchar(24) NOT NULL,
	"delivered_via" varchar(24),
	"mail_id" uuid,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_story_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"source_type" varchar(40) NOT NULL,
	"source_id" varchar(128) NOT NULL,
	"fact_fingerprint" varchar(160) NOT NULL,
	"summary" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"entity_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"importance" integer DEFAULT 1 NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_story_states" (
	"cultivator_id" uuid PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"story_seed" uuid DEFAULT gen_random_uuid() NOT NULL,
	"canon_summary" text DEFAULT '' NOT NULL,
	"active_thread_id" uuid,
	"cooldown_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_story_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"framework_id" varchar(64) NOT NULL,
	"framework_version" integer NOT NULL,
	"stage" varchar(24) NOT NULL,
	"status" varchar(24) NOT NULL,
	"premise" text NOT NULL,
	"unresolved_question" text NOT NULL,
	"entity_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"selected_choice_key" varchar(32),
	"linked_map_node_id" varchar(100),
	"linked_run_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_story_entities" ADD CONSTRAINT "wanjiedaoyou_story_entities_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_story_intents" ADD CONSTRAINT "wanjiedaoyou_story_intents_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_story_intents" ADD CONSTRAINT "wanjiedaoyou_story_intents_thread_id_wanjiedaoyou_story_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."wanjiedaoyou_story_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_story_intents" ADD CONSTRAINT "wanjiedaoyou_story_intents_mail_id_wanjiedaoyou_mails_id_fk" FOREIGN KEY ("mail_id") REFERENCES "public"."wanjiedaoyou_mails"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_story_memories" ADD CONSTRAINT "wanjiedaoyou_story_memories_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_story_states" ADD CONSTRAINT "wanjiedaoyou_story_states_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_story_threads" ADD CONSTRAINT "wanjiedaoyou_story_threads_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_story_threads" ADD CONSTRAINT "wanjiedaoyou_story_threads_linked_run_id_wanjiedaoyou_dungeon_runs_id_fk" FOREIGN KEY ("linked_run_id") REFERENCES "public"."wanjiedaoyou_dungeon_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "story_entities_cultivator_updated_idx" ON "wanjiedaoyou_story_entities" USING btree ("cultivator_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "story_intents_thread_beat_uidx" ON "wanjiedaoyou_story_intents" USING btree ("thread_id","beat_type");--> statement-breakpoint
CREATE UNIQUE INDEX "story_intents_mail_uidx" ON "wanjiedaoyou_story_intents" USING btree ("mail_id") WHERE "wanjiedaoyou_story_intents"."mail_id" is not null;--> statement-breakpoint
CREATE INDEX "story_intents_cultivator_status_created_idx" ON "wanjiedaoyou_story_intents" USING btree ("cultivator_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "story_memories_cultivator_fingerprint_uidx" ON "wanjiedaoyou_story_memories" USING btree ("cultivator_id","fact_fingerprint");--> statement-breakpoint
CREATE INDEX "story_memories_cultivator_occurred_idx" ON "wanjiedaoyou_story_memories" USING btree ("cultivator_id","occurred_at");--> statement-breakpoint
CREATE INDEX "story_memories_source_idx" ON "wanjiedaoyou_story_memories" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "story_threads_one_open_per_cultivator_uidx" ON "wanjiedaoyou_story_threads" USING btree ("cultivator_id") WHERE "wanjiedaoyou_story_threads"."status" in ('active', 'paused');--> statement-breakpoint
CREATE INDEX "story_threads_cultivator_updated_idx" ON "wanjiedaoyou_story_threads" USING btree ("cultivator_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "story_threads_linked_run_uidx" ON "wanjiedaoyou_story_threads" USING btree ("linked_run_id") WHERE "wanjiedaoyou_story_threads"."linked_run_id" is not null;