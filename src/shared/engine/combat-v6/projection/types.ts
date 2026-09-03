import type { Attributes } from "@shared/types/cultivator"
import type { CultivatorCondition } from "@shared/types/condition"
import type { BodyCultivationState } from "@shared/types/condition"
import type { RealmStage, RealmType } from "@shared/types/constants"
import type {
  CombatV6VersionStamp,
  LineupUnit,
  SkillDef,
  StatusDef,
} from "../core/index.ts"
import type { SectCombatProgressV6 } from "../content/types.ts"

export type CombatV6ResourcePolicy = "full" | "persistent"

export interface CultivatorBaseCombatInput {
  id: string
  name: string
  realm: RealmType
  realm_stage: RealmStage
  attributes: Attributes
  condition?: CultivatorCondition
}

export interface ProjectCultivatorBaseInput {
  cultivator: CultivatorBaseCombatInput
  side: 0 | 1
  slot: number
  resourcePolicy: CombatV6ResourcePolicy
}

export type ProjectCultivatorWithTrainingInput = ProjectCultivatorBaseInput

export interface ProjectCultivatorWithTrainingAndSectInput
  extends ProjectCultivatorWithTrainingInput {
  sect: SectCombatProgressV6
}

export interface CombatV6TrainingProjection {
  attackCultivate: number
  defenseCultivate: number
  spellCultivate: number
  resistSpellCultivate: number
  lifeFoundationLevel: number
  maxHpBonus: number
  healPowerBonus: number
  diagnostics: CombatV6ProjectionDiagnostic[]
}

export type CombatV6BodyCultivationInput = BodyCultivationState | undefined

export type CombatV6ProjectionDiagnosticSeverity = "info" | "warning" | "error"

export type CombatV6ProjectionDiagnosticCode =
  | "INVALID_IDENTITY"
  | "INVALID_BASE_ATTRIBUTE"
  | "MISSING_PERSISTENT_RESOURCES"
  | "INVALID_PERSISTENT_RESOURCE"
  | "PERSISTENT_HP_DEPLETED"
  | "RESOURCE_CLAMPED"
  | "PERSISTENT_STATUSES_NOT_PROJECTED"
  | "INVALID_TRAINING_LEVEL"
  | "TRAINING_LEVEL_CLAMPED"
  | "INVALID_SECT_ID"
  | "INVALID_METHOD_SET"
  | "INVALID_METHOD_LEVEL"
  | "METHOD_LEVEL_CAP_EXCEEDED"
  | "BRANCH_METHOD_EXCEEDS_PRIMARY"
  | "INVALID_ACTIVE_PATH"
  | "INVALID_MERIDIAN_LOADOUT"
  | "MERIDIAN_NODE_UNKNOWN"
  | "MERIDIAN_NODE_WRONG_PATH"
  | "MERIDIAN_NODE_LOCKED"
  | "MERIDIAN_LAYER_CONFLICT"
  | "MERIDIAN_SELECTION_INCOMPLETE"
  | "SKILL_SOURCE_METHOD_MISSING"
  | "PATCH_TARGET_MISSING"
  | "PATCH_CONFLICT"
  | "CONTENT_ID_CONFLICT"

export interface CombatV6ProjectionDiagnostic {
  severity: CombatV6ProjectionDiagnosticSeverity
  code: CombatV6ProjectionDiagnosticCode
  message: string
  path?: string
}

type ProjectionCommon = {
  diagnostics: CombatV6ProjectionDiagnostic[]
  versions: CombatV6VersionStamp
}

export type CombatV6ProjectionResult =
  | (ProjectionCommon & {
      ok: true
      unit: LineupUnit
      skills: SkillDef[]
      statusDefs: StatusDef[]
    })
  | (ProjectionCommon & {
      ok: false
    })
