import type { Attributes } from "@shared/types/cultivator"
import type { SkillDef, StatusDef } from "../core/index.ts"
import type {
  CombatV6PanelContribution,
  CombatV6ProjectionDiagnostic,
} from "../projection/types.ts"

export const DAO_EQUIPMENT_GENERATOR_VERSION = "dao_equipment_generator_v1" as const
export const DAO_EQUIPMENT_GENERATOR_VERSION_V2 = "dao_equipment_generator_v2" as const
export type DaoEquipmentGeneratorVersion =
  | typeof DAO_EQUIPMENT_GENERATOR_VERSION
  | typeof DAO_EQUIPMENT_GENERATOR_VERSION_V2

export const DAO_EQUIPMENT_SLOTS = [
  "weapon",
  "head",
  "armor",
  "necklace",
  "belt",
  "footwear",
] as const

export type DaoEquipmentSlot = (typeof DAO_EQUIPMENT_SLOTS)[number]

export type CombatV6PanelAttr =
  | "physicalAtk"
  | "physicalDef"
  | "magicAtk"
  | "magicDef"
  | "maxHp"
  | "maxMp"
  | "healPower"
  | "speed"
  | "hit"
  | "dodge"
  | "critRate"
  | "spellCritRate"
  | "physicalFuryRate"
  | "sealHit"
  | "sealResist"

export type DaoEquipmentAttribute = keyof Attributes

export interface DaoEquipmentPanelRoll {
  attr: CombatV6PanelAttr
  value: number
}

export interface DaoEquipmentAttributeRoll {
  attr: DaoEquipmentAttribute
  value: number
}

export interface DaoFormationInscriptionStateV1 {
  patternId: string
  level: number
}

export interface DaoEquipmentInstanceV1 {
  schemaVersion: 1
  id: string
  templateId: string
  name: string
  slot: DaoEquipmentSlot
  equipmentLevel: number
  requiredLevel: number
  baseStats: DaoEquipmentPanelRoll[]
  attributeBonuses: DaoEquipmentAttributeRoll[]
  essenceIds: string[]
  artId?: string
  formationInscription?: DaoFormationInscriptionStateV1
  appraisalState: "appraised"
  generatorVersion: DaoEquipmentGeneratorVersion
  createdAt: string
}

export type DaoEquipmentLoadoutV1 = Partial<
  Record<DaoEquipmentSlot, DaoEquipmentInstanceV1>
>

export interface DaoEquipmentTemplateV1 {
  id: string
  name: string
  slot: DaoEquipmentSlot
  baseStats: Array<{
    attr: CombatV6PanelAttr
    minCoefficient: number
    maxCoefficient: number
  }>
  favoredAttributes: DaoEquipmentAttribute[]
}

export interface DaoFormationInscriptionDefV1 {
  id: string
  name: string
  attr: CombatV6PanelAttr
  valuePerLevel: number
  allowedSlots: DaoEquipmentSlot[]
}

export interface DaoEquipmentEssenceDefV1 {
  id: string
  name: string
  allowedSlots?: DaoEquipmentSlot[]
  stackPolicy: "stack" | "unique" | "highest"
  conflictGroup?: string
  panel?: CombatV6PanelContribution[]
  requiredLevelOffset?: number
  resourceGainFactors?: Record<string, number>
  resourceCostFactors?: Record<string, number>
}

export interface DaoEquipmentArtDefV1 {
  id: string
  name: string
  allowedSlots?: DaoEquipmentSlot[]
  rageCost: number
  skill: SkillDef
  statusDefs?: StatusDef[]
}

export interface GenerateDaoEquipmentV1Input {
  id: string
  createdAt: string
  seed: number
  templateId: string
  equipmentLevel: number
  generatorVersion: typeof DAO_EQUIPMENT_GENERATOR_VERSION
}

export interface GenerateDaoEquipmentV2Input
  extends Omit<GenerateDaoEquipmentV1Input, "generatorVersion"> {
  generatorVersion: typeof DAO_EQUIPMENT_GENERATOR_VERSION_V2
}

export type DaoEquipmentGenerationResult =
  | {
      ok: true
      instance: DaoEquipmentInstanceV1
      diagnostics: CombatV6ProjectionDiagnostic[]
    }
  | { ok: false; diagnostics: CombatV6ProjectionDiagnostic[] }

export type DaoEquipmentProjectionV1 = {
  attributeBonuses: Attributes
  panel: DaoEquipmentPanelRoll[]
  diagnostics: CombatV6ProjectionDiagnostic[]
}

export type CompileDaoEquipmentLoadoutV1Result =
  | { ok: true; projection: DaoEquipmentProjectionV1 }
  | { ok: false; diagnostics: CombatV6ProjectionDiagnostic[] }

export type DaoEquipmentSpecialProjectionV1 = DaoEquipmentProjectionV1 & {
  effectiveEssenceIds: string[]
  grantedArtIds: string[]
  skills: SkillDef[]
  statusDefs: StatusDef[]
  passiveSkillIds: string[]
  skillOverrides: SkillDef[]
  effectiveRequiredLevels: Partial<Record<DaoEquipmentSlot, number>>
  rageGainFactor: number
  rageCostFactor: number
}

export type CompileDaoEquipmentSpecialLoadoutV1Result =
  | { ok: true; projection: DaoEquipmentSpecialProjectionV1 }
  | { ok: false; diagnostics: CombatV6ProjectionDiagnostic[] }
