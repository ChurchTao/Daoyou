CREATE TABLE "wanjiedaoyou_combat_v6_build_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_id" uuid NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"active_path_id" varchar(160),
	"meridian_depth" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_combat_v6_equipment_instances" (
	"id" varchar(160) PRIMARY KEY NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"generator_version" varchar(64) NOT NULL,
	"instance" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_combat_v6_equipment_loadouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"slot" varchar(32) NOT NULL,
	"equipment_instance_id" varchar(160) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_combat_v6_manual_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state_id" uuid NOT NULL,
	"slot" integer NOT NULL,
	"manual_id" varchar(160) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_combat_v6_manual_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_combat_v6_meridian_loadouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"path_id" varchar(160) NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_combat_v6_meridian_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loadout_id" uuid NOT NULL,
	"node_id" varchar(160) NOT NULL,
	"layer" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_combat_v6_method_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"method_id" varchar(160) NOT NULL,
	"level" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_combat_v6_build_profiles" ADD CONSTRAINT "wanjiedaoyou_combat_v6_build_profiles_membership_id_wanjiedaoyou_sect_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."wanjiedaoyou_sect_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_combat_v6_equipment_instances" ADD CONSTRAINT "wanjiedaoyou_combat_v6_equipment_instances_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_combat_v6_equipment_loadouts" ADD CONSTRAINT "wanjiedaoyou_combat_v6_equipment_loadouts_profile_id_wanjiedaoyou_combat_v6_build_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."wanjiedaoyou_combat_v6_build_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_combat_v6_equipment_loadouts" ADD CONSTRAINT "wanjiedaoyou_combat_v6_equipment_loadouts_equipment_instance_id_wanjiedaoyou_combat_v6_equipment_instances_id_fk" FOREIGN KEY ("equipment_instance_id") REFERENCES "public"."wanjiedaoyou_combat_v6_equipment_instances"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_combat_v6_manual_slots" ADD CONSTRAINT "wanjiedaoyou_combat_v6_manual_slots_state_id_wanjiedaoyou_combat_v6_manual_states_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."wanjiedaoyou_combat_v6_manual_states"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_combat_v6_manual_states" ADD CONSTRAINT "wanjiedaoyou_combat_v6_manual_states_profile_id_wanjiedaoyou_combat_v6_build_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."wanjiedaoyou_combat_v6_build_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_combat_v6_meridian_loadouts" ADD CONSTRAINT "wanjiedaoyou_combat_v6_meridian_loadouts_profile_id_wanjiedaoyou_combat_v6_build_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."wanjiedaoyou_combat_v6_build_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_combat_v6_meridian_nodes" ADD CONSTRAINT "wanjiedaoyou_combat_v6_meridian_nodes_loadout_id_wanjiedaoyou_combat_v6_meridian_loadouts_id_fk" FOREIGN KEY ("loadout_id") REFERENCES "public"."wanjiedaoyou_combat_v6_meridian_loadouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_combat_v6_method_progress" ADD CONSTRAINT "wanjiedaoyou_combat_v6_method_progress_profile_id_wanjiedaoyou_combat_v6_build_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."wanjiedaoyou_combat_v6_build_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "combat_v6_build_membership_unique" ON "wanjiedaoyou_combat_v6_build_profiles" USING btree ("membership_id");--> statement-breakpoint
CREATE INDEX "combat_v6_equipment_cultivator_idx" ON "wanjiedaoyou_combat_v6_equipment_instances" USING btree ("cultivator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "combat_v6_equipment_profile_slot_unique" ON "wanjiedaoyou_combat_v6_equipment_loadouts" USING btree ("profile_id","slot");--> statement-breakpoint
CREATE UNIQUE INDEX "combat_v6_equipment_profile_instance_unique" ON "wanjiedaoyou_combat_v6_equipment_loadouts" USING btree ("profile_id","equipment_instance_id");--> statement-breakpoint
CREATE UNIQUE INDEX "combat_v6_manual_state_slot_unique" ON "wanjiedaoyou_combat_v6_manual_slots" USING btree ("state_id","slot");--> statement-breakpoint
CREATE UNIQUE INDEX "combat_v6_manual_state_manual_unique" ON "wanjiedaoyou_combat_v6_manual_slots" USING btree ("state_id","manual_id");--> statement-breakpoint
CREATE UNIQUE INDEX "combat_v6_manual_profile_unique" ON "wanjiedaoyou_combat_v6_manual_states" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "combat_v6_meridian_profile_path_unique" ON "wanjiedaoyou_combat_v6_meridian_loadouts" USING btree ("profile_id","path_id");--> statement-breakpoint
CREATE UNIQUE INDEX "combat_v6_meridian_loadout_node_unique" ON "wanjiedaoyou_combat_v6_meridian_nodes" USING btree ("loadout_id","node_id");--> statement-breakpoint
CREATE UNIQUE INDEX "combat_v6_meridian_loadout_layer_unique" ON "wanjiedaoyou_combat_v6_meridian_nodes" USING btree ("loadout_id","layer");--> statement-breakpoint
CREATE UNIQUE INDEX "combat_v6_method_profile_method_unique" ON "wanjiedaoyou_combat_v6_method_progress" USING btree ("profile_id","method_id");
--> statement-breakpoint
-- Phase 7B only migrates the six method levels of memberships that are active
-- at deployment time.  Paths, nodes, abilities, manuals and equipment are
-- deliberately not converted from the legacy combat system.
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
	WHERE profile."status" = 'pending'
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
