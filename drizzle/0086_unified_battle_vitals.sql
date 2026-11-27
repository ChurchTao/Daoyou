ALTER TABLE "wanjiedaoyou_invasion_progress" DROP COLUMN "resources";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_invasion_runs" DROP COLUMN "build";
--> statement-breakpoint
UPDATE "wanjiedaoyou_invasion_runs"
SET "phase" = 'finished', "due_at" = NULL, "battle_id" = NULL, "ready" = '{}', "selected_cards" = '{}'
WHERE "phase" <> 'finished';
--> statement-breakpoint
UPDATE "wanjiedaoyou_invasion_progress" SET "active_run_id" = NULL WHERE "active_run_id" IS NOT NULL;
--> statement-breakpoint
UPDATE "wanjiedaoyou_dungeon_runs"
SET "run_state" = "run_state" - 'beastResources' #- '{exorcism,resources}'
WHERE "run_state" ? 'beastResources' OR ("run_state" -> 'exorcism') ? 'resources';
--> statement-breakpoint
UPDATE "wanjiedaoyou_dungeon_runs"
SET "status" = 'FINISHED',
    "run_state" = jsonb_set("run_state" - 'activeBattleId' - 'encounter', '{status}', '"FINISHED"'),
    "active_battle_id" = NULL, "battle_payload" = NULL, "pending_action" = NULL,
    "ended_at" = coalesce("ended_at", now()), "updated_at" = now()
WHERE "status" <> 'FINISHED' AND ("active_battle_id" IS NOT NULL OR "status" IN ('IN_BATTLE', 'SETTLING'));
--> statement-breakpoint
UPDATE "wanjiedaoyou_sect_task_records"
SET "payload" = "payload" #- '{executorData,activeBattleId}' #- '{executorData,battleSettled}'
WHERE "payload" -> 'executorData' ->> 'battleSettled' = 'false';
--> statement-breakpoint
UPDATE "wanjiedaoyou_cultivator_tasks"
SET "metadata" = "metadata" - 'breakthroughBattle'
WHERE "metadata" -> 'breakthroughBattle' ->> 'settled' = 'false';
--> statement-breakpoint
UPDATE "wanjiedaoyou_baixiao_entries" SET "challenge_id" = NULL WHERE "challenge_id" IS NOT NULL;
