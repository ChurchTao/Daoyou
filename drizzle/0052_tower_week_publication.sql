CREATE TABLE "wanjiedaoyou_tower_reward_states" (
	"cultivator_id" uuid PRIMARY KEY NOT NULL,
	"season_key" varchar(40) NOT NULL,
	"claims" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_tower_weeks" (
	"season_key" varchar(40) PRIMARY KEY NOT NULL,
	"schema_version" integer NOT NULL,
	"content_version" varchar(60) NOT NULL,
	"generator_version" varchar(60) NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_tower_reward_states" ADD CONSTRAINT "wanjiedaoyou_tower_reward_states_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;