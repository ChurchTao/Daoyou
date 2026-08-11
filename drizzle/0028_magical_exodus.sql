CREATE TABLE "wanjiedaoyou_battle_replay_archives" (
	"match_id" varchar(120) PRIMARY KEY NOT NULL,
	"replay_version" varchar(40) NOT NULL,
	"engine_version" varchar(40) NOT NULL,
	"ruleset_version" varchar(60) NOT NULL,
	"started_at" timestamp NOT NULL,
	"finished_at" timestamp NOT NULL,
	"outcome" jsonb NOT NULL,
	"participants" jsonb NOT NULL,
	"replay" jsonb NOT NULL,
	"archived_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "battle_replay_archives_finished_idx" ON "wanjiedaoyou_battle_replay_archives" USING btree ("finished_at");--> statement-breakpoint
CREATE INDEX "battle_replay_archives_participants_gin_idx" ON "wanjiedaoyou_battle_replay_archives" USING gin ("participants");