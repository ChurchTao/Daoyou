UPDATE "wanjiedaoyou_story_intents" AS "intent"
SET "payload" = "intent"."payload" || jsonb_build_object(
	'title', '《前尘回响·归档》',
	'content', '现场残留的斗法痕迹足以确认：' || "entity"."name" || '已在这次关联秘境中被你击败并死亡。此后没有新的回信，也没有来自死者的嘱咐。这段纪录只保留你真实做出的选择与结果。',
	'narratorMode', 'system_record',
	'resolutionStatus', CASE
		WHEN COALESCE("run"."run_state"->>'settlementEndDisposition', 'completed') = 'completed' THEN 'resolved'
		WHEN "run"."run_state"->>'settlementEndDisposition' = 'retreated_after_battle' THEN 'partial'
		ELSE 'failed'
	END,
	'nextHook', '',
	'continuityClaims', jsonb_build_array(
		'关联战斗已确认剧情实体死亡',
		'死亡实体没有在结算后再次回信'
	)
)
FROM "wanjiedaoyou_story_threads" AS "thread"
INNER JOIN "wanjiedaoyou_story_entities" AS "entity"
	ON "thread"."entity_ids" ? "entity"."id"::text
LEFT JOIN "wanjiedaoyou_dungeon_runs" AS "run"
	ON "run"."id" = "thread"."linked_run_id"
WHERE
	"intent"."thread_id" = "thread"."id"
	AND "intent"."beat_type" = 'aftermath'
	AND "entity"."life_status" = 'dead';--> statement-breakpoint

UPDATE "wanjiedaoyou_mails" AS "mail"
SET
	"title" = "intent"."payload"->>'title',
	"content" = "intent"."payload"->>'content'
FROM "wanjiedaoyou_story_intents" AS "intent"
INNER JOIN "wanjiedaoyou_story_threads" AS "thread"
	ON "thread"."id" = "intent"."thread_id"
INNER JOIN "wanjiedaoyou_story_entities" AS "entity"
	ON "thread"."entity_ids" ? "entity"."id"::text
WHERE
	"mail"."id" = "intent"."mail_id"
	AND "intent"."beat_type" = 'aftermath'
	AND "entity"."life_status" = 'dead';--> statement-breakpoint

UPDATE "wanjiedaoyou_story_memories" AS "memory"
SET "evidence" = "memory"."evidence" || jsonb_build_object(
	'narratorMode', 'system_record',
	'entityLifeStatus', 'dead',
	'nextHook', ''
)
FROM "wanjiedaoyou_story_threads" AS "thread"
INNER JOIN "wanjiedaoyou_story_entities" AS "entity"
	ON "thread"."entity_ids" ? "entity"."id"::text
WHERE
	"memory"."source_type" = 'story_thread'
	AND "memory"."source_id" = "thread"."id"::text
	AND "entity"."life_status" = 'dead';--> statement-breakpoint

UPDATE "wanjiedaoyou_story_threads" AS "thread"
SET "unresolved_question" = ''
FROM "wanjiedaoyou_story_entities" AS "entity"
WHERE
	"thread"."entity_ids" ? "entity"."id"::text
	AND "entity"."life_status" = 'dead'
	AND "thread"."status" = 'resolved';
