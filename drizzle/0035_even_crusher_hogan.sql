CREATE TABLE "wanjiedaoyou_combat_v6_replay_archives" (
	"battle_id" uuid PRIMARY KEY NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"metadata_version" integer NOT NULL,
	"source_type" varchar(64) NOT NULL,
	"battle_type" varchar(64) NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"engine_version" varchar(40) NOT NULL,
	"ruleset_version" varchar(60) NOT NULL,
	"started_at" timestamp NOT NULL,
	"finished_at" timestamp NOT NULL,
	"outcome" varchar(24) NOT NULL,
	"replay" jsonb NOT NULL,
	"archived_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "combat_v6_replay_source_idempotency_uidx" ON "wanjiedaoyou_combat_v6_replay_archives" USING btree ("source_type","idempotency_key");--> statement-breakpoint
CREATE INDEX "combat_v6_replay_cultivator_finished_idx" ON "wanjiedaoyou_combat_v6_replay_archives" USING btree ("cultivator_id","finished_at");