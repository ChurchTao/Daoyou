-- Run under maintenance before enabling v6 progression writes.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM wanjiedaoyou_sect_path_progress p
    JOIN wanjiedaoyou_sect_memberships m ON m.id = p.membership_id
    WHERE m.status = 'active' AND m.sect_id IN ('lingxiao','youdu','wuxiang','tianyan','jiujie')
      AND jsonb_typeof(p.unlocked_layer_ids) <> 'array'
  ) THEN RAISE EXCEPTION 'Invalid legacy meridian layer array'; END IF;
  IF EXISTS (
    SELECT 1 FROM wanjiedaoyou_sect_path_progress p
    JOIN wanjiedaoyou_sect_memberships m ON m.id = p.membership_id
    CROSS JOIN LATERAL jsonb_array_elements_text(p.unlocked_layer_ids) AS layer(id)
    WHERE m.status = 'active' AND m.sect_id IN ('lingxiao','youdu','wuxiang','tianyan','jiujie')
      AND (layer.id IS NULL OR layer.id NOT IN ('1','2','3','4','5','ultimate'))
  ) THEN RAISE EXCEPTION 'Unknown legacy meridian layer ID'; END IF;
END $$;
--> statement-breakpoint
INSERT INTO "wanjiedaoyou_combat_v6_build_profiles" (
	"membership_id", "schema_version", "revision", "status", "meridian_depth"
)
SELECT "id", 1, 0, 'pending', 0
FROM "wanjiedaoyou_sect_memberships"
WHERE "status" = 'active'
	AND "sect_id" IN ('lingxiao', 'youdu', 'wuxiang', 'tianyan', 'jiujie')
ON CONFLICT ("membership_id") DO NOTHING;
--> statement-breakpoint
WITH method_mapping(sect_id, slot, legacy_method_id, v6_method_id) AS (
	VALUES
		('lingxiao', 1, 'lingxiao-canon', 'lingxiao.method.canon'),
		('lingxiao', 2, 'edge-cleansing', 'lingxiao.method.sword_aura'),
		('lingxiao', 3, 'sword-guidance', 'lingxiao.method.waiting'),
		('lingxiao', 4, 'void-step', 'lingxiao.method.shadow'),
		('lingxiao', 5, 'origin-returning', 'lingxiao.method.formation'),
		('lingxiao', 6, 'sword-nurturing', 'lingxiao.method.clarity'),
		('youdu', 1, 'youdu-canon', 'youdu.method.canon'),
		('youdu', 2, 'three-souls-separation', 'youdu.method.judge'),
		('youdu', 3, 'forgetful-river-record', 'youdu.method.wither'),
		('youdu', 4, 'seven-souls-seizure', 'youdu.method.shadow'),
		('youdu', 5, 'soul-pinning-ironbook', 'youdu.method.asura'),
		('youdu', 6, 'dead-heart-living-spirit', 'youdu.method.insight'),
		('wuxiang', 1, 'wuxiang-canon', 'wuxiang.method.canon'),
		('wuxiang', 2, 'blood-lotus', 'wuxiang.method.compassion'),
		('wuxiang', 3, 'white-bone', 'wuxiang.method.guardian'),
		('wuxiang', 4, 'wrathful-ming', 'wuxiang.method.wrath'),
		('wuxiang', 5, 'six-senses', 'wuxiang.method.purity'),
		('wuxiang', 6, 'reed-crossing-method', 'wuxiang.method.crossing'),
		('tianyan', 1, 'tianyan-canon', 'tianyan.method.canon'),
		('tianyan', 2, 'wood-vitality', 'tianyan.method.wood'),
		('tianyan', 3, 'fire-illumination', 'tianyan.method.fire'),
		('tianyan', 4, 'earth-bearing', 'tianyan.method.earth'),
		('tianyan', 5, 'metal-severing', 'tianyan.method.metal'),
		('tianyan', 6, 'water-flowing', 'tianyan.method.water'),
		('jiujie', 1, 'jiujie-canon', 'jiujie.method.canon'),
		('jiujie', 2, 'calamity-eye', 'jiujie.method.seal'),
		('jiujie', 3, 'heavenly-record', 'jiujie.method.thunder'),
		('jiujie', 4, 'thunder-prison', 'jiujie.method.guardian'),
		('jiujie', 5, 'cause-judgment', 'jiujie.method.pride'),
		('jiujie', 6, 'crossing-calamity', 'jiujie.method.cloud')
), capped AS (
	SELECT
		profile."id" AS profile_id,
		mapping.slot,
		mapping.v6_method_id,
		LEAST(
			GREATEST(COALESCE(legacy."level", 0), 0),
			LEAST(
				180,
				(
					(
						CASE cultivator."realm"
							WHEN '炼气' THEN 0 WHEN '筑基' THEN 1 WHEN '金丹' THEN 2
							WHEN '元婴' THEN 3 WHEN '化神' THEN 4 WHEN '炼虚' THEN 5
							WHEN '合体' THEN 6 WHEN '大乘' THEN 7 WHEN '渡劫' THEN 8
							ELSE 0
						END * 4
						+ CASE cultivator."realm_stage"
							WHEN '初期' THEN 0 WHEN '中期' THEN 1 WHEN '后期' THEN 2
							WHEN '圆满' THEN 3 ELSE 0
						END
						+ 1
					) * 5
				) + 10
			)
		) AS level
	FROM "wanjiedaoyou_combat_v6_build_profiles" profile
	JOIN "wanjiedaoyou_sect_memberships" membership ON membership."id" = profile."membership_id"
	JOIN "wanjiedaoyou_cultivators" cultivator ON cultivator."id" = membership."cultivator_id"
	JOIN method_mapping mapping ON mapping.sect_id = membership."sect_id"
	LEFT JOIN "wanjiedaoyou_sect_method_progress" legacy
		ON legacy."membership_id" = membership."id"
		AND legacy."method_id" = mapping.legacy_method_id
	WHERE profile."status" = 'pending' AND membership."status" = 'active'
), normalized AS (
	SELECT
		profile_id,
		v6_method_id,
		CASE
			WHEN slot = 1 THEN level
			ELSE LEAST(level, MAX(level) FILTER (WHERE slot = 1) OVER (PARTITION BY profile_id))
		END AS level
	FROM capped
)
INSERT INTO "wanjiedaoyou_combat_v6_method_progress" ("profile_id", "method_id", "level")
SELECT profile_id, v6_method_id, level FROM normalized
ON CONFLICT ("profile_id", "method_id") DO NOTHING;
--> statement-breakpoint
WITH depths AS (
  SELECT m.id AS membership_id, MAX(CASE layer.id
    WHEN '1' THEN 1 WHEN '2' THEN 2 WHEN '3' THEN 3
    WHEN '4' THEN 4 WHEN '5' THEN 5 WHEN 'ultimate' THEN 6 ELSE 0 END) AS depth
  FROM wanjiedaoyou_sect_memberships m
  JOIN wanjiedaoyou_sect_path_progress p ON p.membership_id = m.id
  CROSS JOIN LATERAL jsonb_array_elements_text(p.unlocked_layer_ids) AS layer(id)
  WHERE m.status = 'active' AND m.sect_id IN ('lingxiao','youdu','wuxiang','tianyan','jiujie')
  GROUP BY m.id
)
UPDATE wanjiedaoyou_combat_v6_build_profiles p
SET meridian_depth = d.depth, revision = p.revision + 1
FROM depths d
WHERE p.membership_id = d.membership_id AND d.depth > p.meridian_depth;
