import type { Attributes } from "@shared/types/cultivator"
import type { CultivatorCondition } from "@shared/types/condition"
import type { BodyCultivationState } from "@shared/types/condition"
import type { RealmStage, RealmType } from "@shared/types/constants"
import type {
  AttrName,
  CombatV6VersionStamp,
  LineupUnit,
  SkillDef,
  StatusDef,
} from "../core/index.ts"
import type { SectCombatProgressV6 } from "../content/types.ts"
import type { DaoEquipmentLoadoutV1 } from "../equipment/types.ts"
import type { CultivatorManualStateV1 } from "../manuals/types.ts"

export type CombatV6ResourcePolicy = "full" | "persistent"

/** 内容层共用的中立面板贡献契约；具体 build 不得互相依赖。 */
export type CombatV6PanelContribution = {
  attr: AttrName
  mode: "add" | "multiply"
  value: number
}

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

export interface ProjectCultivatorWithEquipmentInput
  extends ProjectCultivatorWithTrainingAndSectInput {
  equipment: DaoEquipmentLoadoutV1
}

export type ProjectCultivatorWithEquipmentSpecialInput =
  ProjectCultivatorWithEquipmentInput

export interface ProjectCultivatorToCombatV6Input
  extends ProjectCultivatorWithEquipmentSpecialInput {
  manuals: CultivatorManualStateV1
}

export interface CompareDaoEquipmentLoadoutsV1Input
  extends Omit<ProjectCultivatorWithEquipmentInput, "equipment"> {
  before: DaoEquipmentLoadoutV1
  after: DaoEquipmentLoadoutV1
}

export type CompareDaoEquipmentLoadoutsV1Result =
  | {
      ok: true
      effectiveAttributeDiffs: Attributes
      panelDiffs: Partial<Record<AttrName, number>>
      beforeDiagnostics: CombatV6ProjectionDiagnostic[]
      afterDiagnostics: CombatV6ProjectionDiagnostic[]
    }
  | {
      ok: false
      beforeDiagnostics: CombatV6ProjectionDiagnostic[]
      afterDiagnostics: CombatV6ProjectionDiagnostic[]
    }

export interface CompareDaoEquipmentSpecialLoadoutsV1Input
  extends Omit<ProjectCultivatorWithEquipmentSpecialInput, "equipment"> {
  before: DaoEquipmentLoadoutV1
  after: DaoEquipmentLoadoutV1
}

export type CompareDaoEquipmentSpecialLoadoutsV1Result =
  | {
      ok: true
      effectiveAttributeDiffs: Attributes
      panelDiffs: Partial<Record<AttrName, number>>
      effectiveEssenceChanges: { added: string[]; removed: string[] }
      grantedArtChanges: { added: string[]; removed: string[] }
      beforeDiagnostics: CombatV6ProjectionDiagnostic[]
      afterDiagnostics: CombatV6ProjectionDiagnostic[]
    }
  | {
      ok: false
      beforeDiagnostics: CombatV6ProjectionDiagnostic[]
      afterDiagnostics: CombatV6ProjectionDiagnostic[]
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
  | "INVALID_EQUIPMENT_IDENTITY"
  | "UNKNOWN_EQUIPMENT_TEMPLATE"
  | "INVALID_EQUIPMENT_LEVEL"
  | "EQUIPMENT_LEVEL_REQUIREMENT"
  | "EQUIPMENT_SLOT_MISMATCH"
  | "DUPLICATE_EQUIPMENT_INSTANCE"
  | "INVALID_EQUIPMENT_BASE_STAT"
  | "INVALID_EQUIPMENT_ATTRIBUTE_BONUS"
  | "FORBIDDEN_EQUIPMENT_FIELD"
  | "UNSUPPORTED_EQUIPMENT_CONTENT"
  | "UNKNOWN_FORMATION_INSCRIPTION"
  | "FORMATION_INSCRIPTION_SLOT_MISMATCH"
  | "FORMATION_INSCRIPTION_LEVEL_INVALID"
  | "UNKNOWN_EQUIPMENT_ESSENCE"
  | "UNKNOWN_EQUIPMENT_ART"
  | "EQUIPMENT_SPECIAL_GENERATOR_MISMATCH"
  | "EQUIPMENT_SPECIAL_SLOT_MISMATCH"
  | "EQUIPMENT_ESSENCE_CONFLICT"
  | "EQUIPMENT_ESSENCE_DUPLICATE_IGNORED"
  | "EQUIPMENT_ART_DUPLICATE_IGNORED"
  | "EQUIPMENT_SPECIAL_CONTENT_INVALID"
  | "INVALID_MANUAL_STATE"
  | "INVALID_MANUAL_REVISION"
  | "MANUAL_SLOT_INVALID"
  | "MANUAL_SLOT_LOCKED"
  | "MANUAL_SLOT_OCCUPIED"
  | "MANUAL_SLOT_EMPTY"
  | "MANUAL_EXPECTED_MISMATCH"
  | "UNKNOWN_MANUAL"
  | "DUPLICATE_MANUAL"
  | "MANUAL_LINEAGE_CONFLICT"
  | "MANUAL_RANK_DOWNGRADE"
  | "MANUAL_CONFLICT_REQUIRES_FORGET"
  | "MANUAL_CONTENT_INVALID"
  | "CAPABILITY_POLICY_CONFLICT"
  | "CAPABILITY_RESOLUTION_CONFLICT"

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
