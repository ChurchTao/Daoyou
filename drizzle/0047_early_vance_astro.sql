CREATE TABLE "wanjiedaoyou_tower_enemy_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_key" varchar(40) NOT NULL,
	"realm" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'ready' NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"enemies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"error_message" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "tower_enemy_sets_season_realm_uidx" ON "wanjiedaoyou_tower_enemy_sets" USING btree ("season_key","realm");--> statement-breakpoint
CREATE INDEX "tower_enemy_sets_realm_generated_idx" ON "wanjiedaoyou_tower_enemy_sets" USING btree ("realm","generated_at");