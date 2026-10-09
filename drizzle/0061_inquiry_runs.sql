CREATE TABLE "wanjiedaoyou_inquiry_histories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"map_node_id" varchar(100) NOT NULL,
	"theme" varchar(100) NOT NULL,
	"correct" boolean NOT NULL,
	"rating" varchar(8),
	"narrative" text NOT NULL,
	"real_gains" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_inquiry_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"map_node_id" varchar(100) NOT NULL,
	"status" varchar(30) DEFAULT 'PREPARING' NOT NULL,
	"template_id" varchar(40) NOT NULL,
	"reward_seed" integer NOT NULL,
	"truth_id" varchar(40),
	"case_file" jsonb,
	"progress" jsonb NOT NULL,
	"narrations" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"v6_rewards" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"battle_payload" jsonb,
	"active_battle_id" uuid,
	"settlement" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_inquiry_histories" ADD CONSTRAINT "wanjiedaoyou_inquiry_histories_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_inquiry_runs" ADD CONSTRAINT "wanjiedaoyou_inquiry_runs_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inquiry_histories_cultivator_created_idx" ON "wanjiedaoyou_inquiry_histories" USING btree ("cultivator_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "inquiry_runs_one_open_idx" ON "wanjiedaoyou_inquiry_runs" USING btree ("cultivator_id") WHERE "wanjiedaoyou_inquiry_runs"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "inquiry_runs_cultivator_updated_idx" ON "wanjiedaoyou_inquiry_runs" USING btree ("cultivator_id","updated_at");