UPDATE "wanjiedaoyou_story_states" AS "state"
SET
	"cooldown_until" = "latest_thread"."resolved_at" + interval '1 day',
	"updated_at" = NOW()
FROM (
	SELECT DISTINCT ON ("cultivator_id")
		"cultivator_id",
		"resolved_at"
	FROM "wanjiedaoyou_story_threads"
	WHERE "resolved_at" IS NOT NULL
	ORDER BY "cultivator_id", "resolved_at" DESC
) AS "latest_thread"
WHERE
	"state"."cultivator_id" = "latest_thread"."cultivator_id"
	AND "state"."active_thread_id" IS NULL
	AND "state"."cooldown_until" IS NOT NULL
	AND "state"."cooldown_until" > "latest_thread"."resolved_at" + interval '1 day';
