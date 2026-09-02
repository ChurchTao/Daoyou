import type { Attributes } from "@shared/types/cultivator"
import type { CultivatorCondition } from "@shared/types/condition"
import type { RealmStage, RealmType } from "@shared/types/constants"
import type {
  CombatV6VersionStamp,
  LineupUnit,
} from "../core/index.ts"

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

export type CombatV6ProjectionDiagnosticSeverity = "info" | "warning" | "error"

export type CombatV6ProjectionDiagnosticCode =
  | "INVALID_IDENTITY"
  | "INVALID_BASE_ATTRIBUTE"
  | "MISSING_PERSISTENT_RESOURCES"
  | "INVALID_PERSISTENT_RESOURCE"
  | "PERSISTENT_HP_DEPLETED"
  | "RESOURCE_CLAMPED"
  | "PERSISTENT_STATUSES_NOT_PROJECTED"

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
      skills: []
      statusDefs: []
    })
  | (ProjectionCommon & {
      ok: false
    })
