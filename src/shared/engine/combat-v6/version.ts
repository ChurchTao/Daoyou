import type { CombatV6VersionStamp } from "./core/index.ts"

/** Phase 1 的不可变版本戳；Host 和投影必须按值复制进战斗快照。 */
export const COMBAT_V6_PHASE_1_VERSIONS: CombatV6VersionStamp = Object.freeze({
  engineVersion: "combat-v6",
  rulesetVersion: "daoyou_rules_v1",
  contentVersion: "empty_content_v1",
  projectionVersion: "character_panel_v1",
})

/** Phase 2 的五轨修炼组合投影版本戳。 */
export const COMBAT_V6_PHASE_2_VERSIONS: CombatV6VersionStamp = Object.freeze({
  engineVersion: "combat-v6",
  rulesetVersion: "daoyou_rules_v1",
  contentVersion: "empty_content_v1",
  projectionVersion: "character_training_v1",
})

/** Phase 3 的红尘剑宗内容与组合投影版本戳。 */
export const COMBAT_V6_PHASE_3_VERSIONS: CombatV6VersionStamp = Object.freeze({
  engineVersion: "combat-v6",
  rulesetVersion: "daoyou_rules_v1",
  contentVersion: "daoyou_sect_content_v1",
  projectionVersion: "character_sect_v1",
})

/** Phase 4A 的道装、红尘剑宗与完整角色组合投影版本戳。 */
export const COMBAT_V6_PHASE_4A_VERSIONS: CombatV6VersionStamp = Object.freeze({
  engineVersion: "combat-v6",
  rulesetVersion: "daoyou_rules_v1",
  contentVersion: "daoyou_sect_equipment_content_v1",
  projectionVersion: "character_equipment_v1",
})

/** Phase 4B 的器蕴、器诀、战意与完整角色组合投影版本戳。 */
export const COMBAT_V6_PHASE_4B_VERSIONS: CombatV6VersionStamp = Object.freeze({
  engineVersion: "combat-v6",
  rulesetVersion: "daoyou_rules_v1",
  contentVersion: "daoyou_sect_equipment_special_content_v1",
  projectionVersion: "character_equipment_special_v1",
})

/** Phase 5A 的角色完整构筑与功法内容版本戳。 */
export const COMBAT_V6_PHASE_5A_VERSIONS: CombatV6VersionStamp = Object.freeze({
  engineVersion: "combat-v6",
  rulesetVersion: "daoyou_rules_v1",
  contentVersion: "daoyou_character_build_content_v1",
  projectionVersion: "character_build_v1",
})

/** Phase 6A 的多宗门完整构筑与幽都内容版本戳。 */
export const COMBAT_V6_PHASE_6A_VERSIONS: CombatV6VersionStamp = Object.freeze({
  engineVersion: "combat-v6",
  rulesetVersion: "daoyou_rules_v2",
  contentVersion: "daoyou_character_build_content_v2",
  projectionVersion: "character_build_v2",
})

/** Phase 6B 的三宗门完整构筑、治疗防护原语与无相内容版本戳。 */
export const COMBAT_V6_PHASE_6B_VERSIONS: CombatV6VersionStamp = Object.freeze({
  engineVersion: "combat-v6",
  rulesetVersion: "daoyou_rules_v3",
  contentVersion: "daoyou_character_build_content_v3",
  projectionVersion: "character_build_v3",
})

/** Phase 6C 的四宗门完整构筑、五行法印与反应版本戳。 */
export const COMBAT_V6_PHASE_6C_VERSIONS: CombatV6VersionStamp = Object.freeze({
  engineVersion: "combat-v6",
  rulesetVersion: "daoyou_rules_v4",
  contentVersion: "daoyou_character_build_content_v4",
  projectionVersion: "character_build_v4",
})

/** Phase 6D 的五宗门完整构筑、三封、电芒与概率裁定版本戳。 */
export const COMBAT_V6_PHASE_6D_VERSIONS: CombatV6VersionStamp = Object.freeze({
  engineVersion: "combat-v6",
  rulesetVersion: "daoyou_rules_v5",
  contentVersion: "daoyou_character_build_content_v5",
  projectionVersion: "character_build_v5",
})

/** Phase 7A 的训练遭遇内容与纯逻辑 Host 版本戳。 */
export const COMBAT_V6_PHASE_7A_VERSIONS: CombatV6VersionStamp = Object.freeze({
  engineVersion: "combat-v6",
  rulesetVersion: "daoyou_rules_v5",
  contentVersion: "daoyou_training_encounter_content_v1",
  projectionVersion: "training_encounter_v1",
})

/** Phase 7B 沿用7A战斗内容；新增的是持久构筑和服务端训练协议。 */
export const COMBAT_V6_PHASE_7B_VERSIONS: CombatV6VersionStamp = Object.freeze({
  ...COMBAT_V6_PHASE_7A_VERSIONS,
})

/** Phase 7C 沿用7A规则与内容；新增Redis运行协议、终局事件和回放版本。 */
export const COMBAT_V6_PHASE_7C_VERSIONS: CombatV6VersionStamp = Object.freeze({
  ...COMBAT_V6_PHASE_7A_VERSIONS,
})
