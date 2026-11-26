CREATE TABLE "wanjiedaoyou_invasion_progress" (
	"week" date NOT NULL,
	"user_id" uuid NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"reward_realm" text NOT NULL,
	"reward_stage" text NOT NULL,
	"active_run_id" uuid,
	"completed_wave" integer DEFAULT 0 NOT NULL,
	"last_run_id" uuid,
	"last_battle_id" uuid,
	"resources" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cards" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rewarded_wave" integer DEFAULT 0 NOT NULL,
	"reward" jsonb,
	CONSTRAINT "wanjiedaoyou_invasion_progress_week_user_id_pk" PRIMARY KEY("week","user_id"),
	CONSTRAINT "invasion_progress_waves_valid" CHECK ("wanjiedaoyou_invasion_progress"."rewarded_wave" >= 0 and "wanjiedaoyou_invasion_progress"."completed_wave" >= "wanjiedaoyou_invasion_progress"."rewarded_wave"),
	CONSTRAINT "invasion_progress_score_valid" CHECK (("wanjiedaoyou_invasion_progress"."completed_wave" = 0 and "wanjiedaoyou_invasion_progress"."last_run_id" is null) or ("wanjiedaoyou_invasion_progress"."completed_wave" > 0 and "wanjiedaoyou_invasion_progress"."last_run_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_invasion_recruitments" (
	"week" date NOT NULL,
	"party_id" uuid NOT NULL,
	"party_revision" integer NOT NULL,
	"ready" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"advertised" boolean DEFAULT false NOT NULL,
	CONSTRAINT "wanjiedaoyou_invasion_recruitments_week_party_id_pk" PRIMARY KEY("week","party_id")
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_invasion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week" date NOT NULL,
	"party_id" uuid NOT NULL,
	"party_revision" integer NOT NULL,
	"leader_id" uuid NOT NULL,
	"realm" text NOT NULL,
	"members" jsonb NOT NULL,
	"phase" text NOT NULL,
	"wave" integer NOT NULL,
	"started_at" bigint NOT NULL,
	"due_at" bigint,
	"battle_id" uuid,
	"launch_id" uuid NOT NULL,
	"ready" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"selected_cards" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"build" jsonb,
	CONSTRAINT "invasion_runs_phase_valid" CHECK ("wanjiedaoyou_invasion_runs"."phase" in ('launching', 'battle', 'rest', 'finished')),
	CONSTRAINT "invasion_runs_wave_valid" CHECK ("wanjiedaoyou_invasion_runs"."wave" > 0)
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_invasion_weeks" (
	"week" date PRIMARY KEY NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"materials" jsonb NOT NULL,
	"announced_at" timestamp with time zone,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"leader_id" uuid NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_party_members" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_invasion_progress" ADD CONSTRAINT "wanjiedaoyou_invasion_progress_week_wanjiedaoyou_invasion_weeks_week_fk" FOREIGN KEY ("week") REFERENCES "public"."wanjiedaoyou_invasion_weeks"("week") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_invasion_progress" ADD CONSTRAINT "wanjiedaoyou_invasion_progress_active_run_id_wanjiedaoyou_invasion_runs_id_fk" FOREIGN KEY ("active_run_id") REFERENCES "public"."wanjiedaoyou_invasion_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_invasion_progress" ADD CONSTRAINT "wanjiedaoyou_invasion_progress_last_run_id_wanjiedaoyou_invasion_runs_id_fk" FOREIGN KEY ("last_run_id") REFERENCES "public"."wanjiedaoyou_invasion_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_invasion_recruitments" ADD CONSTRAINT "wanjiedaoyou_invasion_recruitments_week_wanjiedaoyou_invasion_weeks_week_fk" FOREIGN KEY ("week") REFERENCES "public"."wanjiedaoyou_invasion_weeks"("week") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_invasion_recruitments" ADD CONSTRAINT "wanjiedaoyou_invasion_recruitments_party_id_wanjiedaoyou_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."wanjiedaoyou_parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_invasion_runs" ADD CONSTRAINT "wanjiedaoyou_invasion_runs_week_wanjiedaoyou_invasion_weeks_week_fk" FOREIGN KEY ("week") REFERENCES "public"."wanjiedaoyou_invasion_weeks"("week") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_party_members" ADD CONSTRAINT "wanjiedaoyou_party_members_party_id_wanjiedaoyou_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."wanjiedaoyou_parties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invasion_progress_active_idx" ON "wanjiedaoyou_invasion_progress" USING btree ("active_run_id") WHERE "wanjiedaoyou_invasion_progress"."active_run_id" is not null;--> statement-breakpoint
CREATE INDEX "invasion_progress_cultivator_idx" ON "wanjiedaoyou_invasion_progress" USING btree ("cultivator_id") WHERE "wanjiedaoyou_invasion_progress"."active_run_id" is not null;--> statement-breakpoint
CREATE INDEX "invasion_progress_pending_idx" ON "wanjiedaoyou_invasion_progress" USING btree ("week","user_id") WHERE "wanjiedaoyou_invasion_progress"."rewarded_wave" < "wanjiedaoyou_invasion_progress"."completed_wave";--> statement-breakpoint
CREATE INDEX "invasion_runs_due_idx" ON "wanjiedaoyou_invasion_runs" USING btree ("due_at") WHERE "wanjiedaoyou_invasion_runs"."due_at" is not null;--> statement-breakpoint
CREATE INDEX "invasion_runs_week_phase_idx" ON "wanjiedaoyou_invasion_runs" USING btree ("week","phase");--> statement-breakpoint
CREATE UNIQUE INDEX "party_member_cultivator_idx" ON "wanjiedaoyou_party_members" USING btree ("cultivator_id");--> statement-breakpoint
CREATE INDEX "party_member_party_idx" ON "wanjiedaoyou_party_members" USING btree ("party_id");