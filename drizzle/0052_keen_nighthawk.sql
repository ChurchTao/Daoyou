CREATE TABLE "wanjiedaoyou_cultivator_state_versions" (
	"cultivator_id" uuid PRIMARY KEY NOT NULL,
	"global_version" bigint DEFAULT 0 NOT NULL,
	"profile_version" bigint DEFAULT 0 NOT NULL,
	"condition_version" bigint DEFAULT 0 NOT NULL,
	"progress_version" bigint DEFAULT 0 NOT NULL,
	"currency_version" bigint DEFAULT 0 NOT NULL,
	"inventory_version" bigint DEFAULT 0 NOT NULL,
	"products_version" bigint DEFAULT 0 NOT NULL,
	"mail_version" bigint DEFAULT 0 NOT NULL,
	"tasks_version" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_player_state_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "wanjiedaoyou_player_state_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"cultivator_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"global_version" bigint NOT NULL,
	"domain_version" bigint NOT NULL,
	"domain" varchar(32) NOT NULL,
	"event_type" varchar(96) NOT NULL,
	"patch" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"invalidates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" varchar(96) NOT NULL,
	"request_id" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivator_state_versions" ADD CONSTRAINT "wanjiedaoyou_cultivator_state_versions_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_player_state_events" ADD CONSTRAINT "wanjiedaoyou_player_state_events_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "player_state_events_cultivator_version_idx" ON "wanjiedaoyou_player_state_events" USING btree ("cultivator_id","global_version","id");--> statement-breakpoint
CREATE INDEX "player_state_events_user_idx" ON "wanjiedaoyou_player_state_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "player_state_events_created_idx" ON "wanjiedaoyou_player_state_events" USING btree ("created_at");