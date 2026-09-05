import type {
  CombatResourceState,
  SkillDef,
  SkillEffect,
  StatusDef,
} from "../core/index.ts"
import type {
  CombatV6PanelContribution,
  CombatV6ProjectionDiagnostic,
} from "../projection/types.ts"

export type SectMethodDefV6 = {
  id: string
  slot: 1 | 2 | 3 | 4 | 5 | 6
  name: string
  isPrimary: boolean
  panel?: CombatV6PanelContribution
}

export type CombatV6SectIdV1 = "lingxiao" | "youdu"
export type CombatV6SectIdV2 = CombatV6SectIdV1 | "wuxiang"
export type CombatV6SectIdV3 = CombatV6SectIdV2 | "tianyan"
export type CombatV6SectId = CombatV6SectIdV3 | "jiujie"

export type SectSkillDefV6 = {
  sourceMethodId: string
  unlockMethodLevel: number
  kind: "active" | "passive" | "internal"
  definition: SkillDef
}

export type SkillPatchV6 =
  | { skillId: string; operation: "setRequireHpRatio"; value: number }
  | { skillId: string; operation: "capRequireHpRatio"; value: number }
  | { skillId: string; operation: "setCostHp"; value: number | string }
  | { skillId: string; operation: "setTargetCount"; value: number | string }
  | { skillId: string; operation: "addResourceTargetCount"; resourceId: string; min: number; value: number | string }
  | { skillId: string; operation: "multiplyPhysicalCoefficients"; value: number }
  | { skillId: string; operation: "addPhysicalCoefficient"; hitIndex: number; value: number }
  | { skillId: string; operation: "setPhysicalDefenseIgnore"; value: number }
  | { skillId: string; operation: "setPhysicalCannotMiss"; value: boolean }
  | { skillId: string; operation: "multiplyFixedPower"; value: number }
  | { skillId: string; operation: "multiplyWoundPower"; value: number }
  | { skillId: string; operation: "multiplyHealPower"; value: number }
  | { skillId: string; operation: "multiplyBarrierPower"; value: number }
  | { skillId: string; operation: "multiplyRemoveWoundPower"; value: number }
  | { skillId: string; operation: "setDispelMaxCount"; value: number | string }
  | { skillId: string; operation: "setDispelExcludeStatusFlags"; value: import("../core/index.ts").StatusFlag[] }
  | { skillId: string; operation: "setReviveRatio"; value: number | string; whenStatusId?: string; statusPresent?: boolean }
  | { skillId: string; operation: "addSpellDefenseIgnore"; value: number }
  | { skillId: string; operation: "multiplySpellCoefficients"; value: number }
  | { skillId: string; operation: "addSpellPower"; value: number | string }
  | { skillId: string; operation: "setSplash"; perTarget: number; floor: number }
  | { skillId: string; operation: "appendSuccessEffect"; effect: SkillEffect }
  | { skillId: string; operation: "setBarrierDuration"; barrierId: string; value: number | string }
  | { skillId: string; operation: "setSealBase"; value: number }
  | { skillId: string; operation: "addSealBase"; value: number }
  | { skillId: string; operation: "setStatusDuration"; statusId: string; value: number | string }
  | { skillId: string; operation: "replaceStatusId"; from: string; to: string }
  | { skillId: string; operation: "appendEffect"; effect: SkillEffect }
  | { skillId: string; operation: "prependEffect"; effect: SkillEffect }
  | { skillId: string; operation: "removeEffectType"; effectType: SkillEffect["type"] }
  | { skillId: string; operation: "setEffectTargetCount"; effectType: SkillEffect["type"]; value: number | string }
  | { skillId: string; operation: "setCopyStatusDurationAdd"; value: number | string }
  | { skillId: string; operation: "multiplyRestoreMpPower"; value: number }
  | { skillId: string; operation: "multiplyCostMp"; value: number }
  | { skillId: string; operation: "setRandomBranchChance"; branchId: string; value: number | string }
  | { skillId: string; operation: "setRandomBranchFixedPower"; branchId: string; value: number | string }
  | { skillId: string; operation: "setEffectPower"; effectType: SkillEffect["type"]; value: number | string; primaryTargetStatusId?: string }
  | { skillId: string; operation: "multiplyEffectPower"; effectType: SkillEffect["type"]; value: number; primaryTargetStatusId?: string }

export type MeridianNodeDefV6 = {
  id: string
  name: string
  pathId: string
  layer: 1 | 2 | 3 | 4 | 5 | 6 | 7
  slot: 1 | 2 | 3
  description: string
  panel?: CombatV6PanelContribution[]
  passives?: SectSkillDefV6[]
  grantSkills?: SectSkillDefV6[]
  revokeSkillIds?: string[]
  patches?: SkillPatchV6[]
}

export type SectPathDefV6 = {
  id: string
  name: string
  panel?: CombatV6PanelContribution[]
  foundationPassives?: SectSkillDefV6[]
  grantSkills?: SectSkillDefV6[]
  revokeSkillIds?: string[]
  resources?: CombatResourceState[]
  patches?: SkillPatchV6[]
  nodes: MeridianNodeDefV6[]
}

export type SectDefinitionV6 = {
  id: CombatV6SectId
  name: string
  methods: SectMethodDefV6[]
  skills: SectSkillDefV6[]
  statuses: StatusDef[]
  paths: [SectPathDefV6, SectPathDefV6]
}

export type SectMeridianLoadoutV6 = {
  pathId: string
  nodeIds: string[]
  revision: number
}

export type SectCombatProgressV6 = {
  version: 1
  sectId: CombatV6SectId
  methods: Record<string, number>
  meridianDepth: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
  activePathId: string
  meridianLoadouts: [SectMeridianLoadoutV6, SectMeridianLoadoutV6]
}

export type CompileSectCombatV6Input = {
  definition: SectDefinitionV6
  progress: SectCombatProgressV6
  characterLevel: number
}

export type SectCombatProjectionV6 = {
  skills: SkillDef[]
  statusDefs: StatusDef[]
  activeSkillIds: string[]
  passiveSkillIds: string[]
  skillLevels: Record<string, number>
  skillOverrides: SkillDef[]
  resources: CombatResourceState[]
  panel: CombatV6PanelContribution[]
  unitTags: string[]
  diagnostics: CombatV6ProjectionDiagnostic[]
}

export type CompileSectCombatV6Result =
  | { ok: true; projection: SectCombatProjectionV6 }
  | { ok: false; diagnostics: CombatV6ProjectionDiagnostic[] }
