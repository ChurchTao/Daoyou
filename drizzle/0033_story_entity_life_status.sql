ALTER TABLE "wanjiedaoyou_story_entities" ADD COLUMN "life_status" varchar(24) DEFAULT 'active' NOT NULL;--> statement-breakpoint
UPDATE "wanjiedaoyou_story_entities" AS "entity"
SET
	"life_status" = 'dead',
	"relationship" = 'hostile',
	"state" = '在关联秘境中被玩家击败，死亡结果已确认'
FROM "wanjiedaoyou_story_threads" AS "thread"
INNER JOIN "wanjiedaoyou_dungeon_runs" AS "run"
	ON "run"."id" = "thread"."linked_run_id"
WHERE
	"thread"."cultivator_id" = "entity"."cultivator_id"
	AND "thread"."entity_ids" ? "entity"."id"::text
	AND COALESCE("run"."run_state"->'defeatedEnemyNames', '[]'::jsonb) ? "entity"."name";
