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
