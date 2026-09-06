-- v6 is unreleased. Discard development archives; no legacy payload conversion.
TRUNCATE TABLE "wanjiedaoyou_combat_v6_replay_archives";
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_combat_v6_replay_participants" (
	"battle_id" uuid NOT NULL,
	"cultivator_id" uuid NOT NULL,
	CONSTRAINT "wanjiedaoyou_combat_v6_replay_participants_battle_id_cultivator_id_pk" PRIMARY KEY("battle_id","cultivator_id")
);
--> statement-breakpoint
DROP INDEX "combat_v6_replay_cultivator_finished_idx";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_combat_v6_replay_participants" ADD CONSTRAINT "wanjiedaoyou_combat_v6_replay_participants_battle_id_wanjiedaoyou_combat_v6_replay_archives_battle_id_fk" FOREIGN KEY ("battle_id") REFERENCES "public"."wanjiedaoyou_combat_v6_replay_archives"("battle_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "combat_v6_replay_participant_cultivator_idx" ON "wanjiedaoyou_combat_v6_replay_participants" USING btree ("cultivator_id","battle_id");--> statement-breakpoint
CREATE INDEX "combat_v6_replay_finished_idx" ON "wanjiedaoyou_combat_v6_replay_archives" USING btree ("finished_at");--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_combat_v6_replay_archives" DROP COLUMN "cultivator_id";
