CREATE TABLE "wanjiedaoyou_herb_garden_profiles" (
	"cultivator_id" uuid PRIMARY KEY NOT NULL,
	"total_harvests" integer DEFAULT 0 NOT NULL,
	"total_visits" integer DEFAULT 0 NOT NULL,
	"initialized_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_herb_garden_plots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"slot" integer NOT NULL,
	"herb_key" varchar(64) NOT NULL,
	"seed_quality" varchar(16) NOT NULL,
	"planted_at" timestamp DEFAULT now() NOT NULL,
	"ready_at" timestamp NOT NULL,
	"base_yield" integer NOT NULL,
	"remaining_yield" integer NOT NULL,
	"steal_limit" integer DEFAULT 0 NOT NULL,
	"stolen_count" integer DEFAULT 0 NOT NULL,
	"mutation_chance" double precision DEFAULT 0 NOT NULL,
	"mutation_rank" varchar(20),
	"seed_return_chance" double precision DEFAULT 0 NOT NULL,
	"modifier_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_herb_garden_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plot_id" uuid,
	"owner_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" varchar(16) NOT NULL,
	"herb_key" varchar(64) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_herb_garden_profiles" ADD CONSTRAINT "herb_garden_profiles_cultivator_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_herb_garden_plots" ADD CONSTRAINT "herb_garden_plots_cultivator_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_herb_garden_interactions" ADD CONSTRAINT "herb_garden_interactions_owner_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_herb_garden_interactions" ADD CONSTRAINT "herb_garden_interactions_actor_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "herb_garden_plots_owner_slot_uidx" ON "wanjiedaoyou_herb_garden_plots" USING btree ("cultivator_id","slot");
--> statement-breakpoint
CREATE INDEX "herb_garden_plots_owner_ready_idx" ON "wanjiedaoyou_herb_garden_plots" USING btree ("cultivator_id","ready_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "herb_garden_interactions_plot_actor_action_uidx" ON "wanjiedaoyou_herb_garden_interactions" USING btree ("plot_id","actor_id","action") WHERE "plot_id" is not null;
--> statement-breakpoint
CREATE INDEX "herb_garden_interactions_owner_created_idx" ON "wanjiedaoyou_herb_garden_interactions" USING btree ("owner_id","created_at");
--> statement-breakpoint
CREATE INDEX "herb_garden_interactions_actor_created_idx" ON "wanjiedaoyou_herb_garden_interactions" USING btree ("actor_id","created_at");
