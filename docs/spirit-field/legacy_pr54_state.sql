-- Optional bridge for environments that already ran PR54 before this V2 patch.
-- IMPORTANT: PR54 was still unmerged; its in-flight plot payload references the old hard-coded plant catalog.
-- This bridge preserves top-level progression only, deliberately resets in-flight plots and lets players claim
-- newly generated V2 starter seeds again. Review before running in any environment with valuable test data.

INSERT INTO "wanjiedaoyou_spirit_fields" (
  "cultivator_id",
  "level",
  "self_harvest_count",
  "total_care_count",
  "starter_claimed",
  "plots"
)
SELECT
  "id",
  LEAST(6, GREATEST(0, COALESCE(("game_settings" #>> '{spiritField,level}')::integer, 0))),
  GREATEST(0, COALESCE(("game_settings" #>> '{spiritField,selfHarvestCount}')::integer, 0)),
  GREATEST(0, COALESCE(("game_settings" #>> '{spiritField,totalCareCount}')::integer, 0)),
  false,
  '[]'::jsonb
FROM "wanjiedaoyou_cultivators"
WHERE "game_settings" ? 'spiritField'
ON CONFLICT ("cultivator_id") DO NOTHING;

UPDATE "wanjiedaoyou_cultivators"
SET "game_settings" = "game_settings" - 'spiritField'
WHERE "game_settings" ? 'spiritField';

-- PR54 V1 灵种依赖旧 plantId 目录，V2 不再兼容该硬编码目录。
-- 若确认这些都是 PR54 测试数据，可清理旧 V1 灵种，避免储物袋残留不可播种物品。
DELETE FROM "wanjiedaoyou_materials"
WHERE "details" #>> '{spiritFieldSeed,version}' = '1';
