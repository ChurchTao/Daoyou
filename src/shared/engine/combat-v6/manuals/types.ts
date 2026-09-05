import type { RealmType } from "@shared/types/constants"
import type { SkillDef } from "../core/index.ts"
import type {
  CombatV6PanelContribution,
  CombatV6ProjectionDiagnostic,
} from "../projection/types.ts"

export type ManualRankV1 = "base" | "true"
export type ManualSlotV1 = 1 | 2 | 3 | 4 | 5 | 6

export interface ManualBuildV1 {
  slots: Array<{ slot: ManualSlotV1; manualId: string }>
}

export interface CultivatorManualStateV1 {
  version: 1
  revision: number
  build: ManualBuildV1
}

export type CombatV6CapabilityStackPolicy = "stack" | "unique" | "highest"

export interface CombatV6CapabilityContribution {
  capabilityKey: string
  sourceType: "manual" | "equipment" | "sect" | "meridian"
  sourceId: string
  stackPolicy: CombatV6CapabilityStackPolicy
  priority: number
  strength?: number
  passiveIds: string[]
}

export interface CharacterManualDefV1 {
  id: string
  lineageId: string
  rank: ManualRankV1
  name: string
  description: string
  conflictGroups: string[]
  skill?: SkillDef
  panel?: CombatV6PanelContribution[]
  unitTags?: string[]
  capability?: Omit<CombatV6CapabilityContribution, "sourceType" | "sourceId" | "passiveIds">
}

export interface CharacterManualProjectionV1 {
  skills: SkillDef[]
  passiveSkillIds: string[]
  skillLevels: Record<string, number>
  panel: CombatV6PanelContribution[]
  unitTags: string[]
  capabilities: CombatV6CapabilityContribution[]
  diagnostics: CombatV6ProjectionDiagnostic[]
}

export type CompileCharacterManualsV1Result =
  | { ok: true; projection: CharacterManualProjectionV1 }
  | { ok: false; diagnostics: CombatV6ProjectionDiagnostic[] }

export type ResolveCombatCapabilitiesV1Result =
  | {
      ok: true
      contributions: CombatV6CapabilityContribution[]
      passiveIds: string[]
      diagnostics: CombatV6ProjectionDiagnostic[]
    }
  | { ok: false; diagnostics: CombatV6ProjectionDiagnostic[] }

export interface LearnManualV1Input {
  state: CultivatorManualStateV1
  realm: RealmType
  slot: ManualSlotV1
  manualId: string
  expectedRevision: number
}

export interface ReplaceManualV1Input extends LearnManualV1Input {
  expectedManualId: string
}

export interface ForgetManualV1Input {
  state: CultivatorManualStateV1
  realm: RealmType
  slot: ManualSlotV1
  expectedManualId: string
  expectedRevision: number
}

export type ManualStateChangeResult =
  | {
      ok: true
      state: CultivatorManualStateV1
      diagnostics: CombatV6ProjectionDiagnostic[]
    }
  | { ok: false; diagnostics: CombatV6ProjectionDiagnostic[] }
