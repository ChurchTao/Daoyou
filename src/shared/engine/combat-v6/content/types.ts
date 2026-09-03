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
  | { skillId: string; operation: "appendEffect"; effect: SkillEffect }
  | { skillId: string; operation: "prependEffect"; effect: SkillEffect }
  | { skillId: string; operation: "removeEffectType"; effectType: SkillEffect["type"] }

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
  foundationPassives?: SectSkillDefV6[]
  grantSkills?: SectSkillDefV6[]
  revokeSkillIds?: string[]
  resources?: CombatResourceState[]
  patches?: SkillPatchV6[]
  nodes: MeridianNodeDefV6[]
}

export type SectDefinitionV6 = {
  id: string
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
  sectId: "lingxiao"
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
