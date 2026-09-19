import { equipmentRealm, isOpenEquipmentLevel } from "./realm"
import { SeededRng } from "../core/index.ts"
import type { CombatV6ProjectionDiagnostic } from "../projection/types.ts"
import { DAO_EQUIPMENT_BASE_GENERATION, daoEquipmentBaseRange, daoEquipmentAttributeRange, daoEquipmentTemplateOf } from "./content.ts"
import { DAO_EQUIPMENT_SPECIAL_GENERATION, equipmentArtPool, equipmentEssencePool } from "./forging-content.ts"
import {
  DAO_EQUIPMENT_GENERATOR_VERSION,
  DAO_EQUIPMENT_GENERATOR_VERSION_V2,
  type DaoEquipmentAttribute,
  type DaoEquipmentAttributeRoll,
  type DaoEquipmentGenerationResult,
  type GenerateDaoEquipmentV1Input,
  type GenerateDaoEquipmentV2Input,
} from "./types.ts"

const ATTRIBUTES: DaoEquipmentAttribute[] = [
  "vitality",
  "strength",
  "spirit",
  "endurance",
  "speed",
  "willpower",
]

function error(
  code: CombatV6ProjectionDiagnostic["code"],
  message: string,
  path?: string,
): CombatV6ProjectionDiagnostic {
  return { severity: "error", code, message, ...(path ? { path } : {}) }
}



function integer(rng: SeededRng, min: number, max: number): number {
  return min + Math.floor(rng.next() * (max - min + 1))
}

function bonusCount(roll: number): 0 | 1 | 2 {
  const [zero, one] = DAO_EQUIPMENT_BASE_GENERATION.bonusCountProbabilities
  if (roll < zero) return 0
  if (roll < zero + one) return 1
  return 2
}

export function generateDaoEquipmentV1(
  input: GenerateDaoEquipmentV1Input,
): DaoEquipmentGenerationResult {
  const diagnostics: CombatV6ProjectionDiagnostic[] = []
  const template = daoEquipmentTemplateOf(input.templateId)
  if (!template) {
    diagnostics.push(error("UNKNOWN_EQUIPMENT_TEMPLATE", "道装模板不存在", "templateId"))
  }
  if (!isOpenEquipmentLevel(input.equipmentLevel)) {
    diagnostics.push(error("INVALID_EQUIPMENT_LEVEL", "道装仅开放至化神期", "equipmentLevel"))
  }
  if (!Number.isInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) {
    diagnostics.push(error("INVALID_EQUIPMENT_IDENTITY", "seed 必须是0～2^32-1的整数", "seed"))
  }
  if (!input.id?.trim() || !input.createdAt?.trim()) {
    diagnostics.push(error("INVALID_EQUIPMENT_IDENTITY", "道装 id 与 createdAt 不能为空"))
  }
  if (input.generatorVersion !== DAO_EQUIPMENT_GENERATOR_VERSION) {
    diagnostics.push(error("INVALID_EQUIPMENT_IDENTITY", "生成器版本不受支持", "generatorVersion"))
  }
  if (!Number.isFinite(input.baseQuality ?? 0) || (input.baseQuality ?? 0) < 0 || (input.baseQuality ?? 0) > 1)
    diagnostics.push(error("INVALID_EQUIPMENT_IDENTITY", "材料品阶进度必须在0～1之间", "baseQuality"))
  if (!template || diagnostics.length > 0) return { ok: false, diagnostics }

  const { rng, baseStats, attributeBonuses } = generateBaseRolls(
    input.seed,
    input.equipmentLevel,
    template,
    input.baseQuality ?? 0,
  )
  void rng
  return {
    ok: true,
    instance: {
      schemaVersion: 1,
      numericVersion: 2,
      baseQuality: input.baseQuality ?? 0,
      id: input.id,
      templateId: template.id,
      name: template.name,
      slot: template.slot,
      equipmentLevel: input.equipmentLevel,
      requiredLevel: equipmentRealm(input.equipmentLevel).requiredLevel,
      baseStats,
      attributeBonuses,
      essenceIds: [],
      artId: undefined,
      formationInscription: undefined,
      appraisalState: "appraised",
      generatorVersion: DAO_EQUIPMENT_GENERATOR_VERSION,
      createdAt: input.createdAt,
    },
    diagnostics,
  }
}

function generateBaseRolls(
  seed: number,
  equipmentLevel: number,
  template: NonNullable<ReturnType<typeof daoEquipmentTemplateOf>>,
  baseQuality: number,
): {
  rng: SeededRng
  baseStats: Array<{ attr: (typeof template.baseStats)[number]["attr"]; value: number }>
  attributeBonuses: DaoEquipmentAttributeRoll[]
} {
  const rng = new SeededRng(seed)
  const baseStats = template.baseStats.map((rule) => {
    const { min, max } = daoEquipmentBaseRange(rule, equipmentLevel, baseQuality)
    return { attr: rule.attr, value: integer(rng, min, max) }
  })
  const countRoll = rng.next()
  const count = template.slot === "weapon" || template.slot === "armor" ? bonusCount(countRoll) : 0
  const { min: minBonus, max: maxBonus } = daoEquipmentAttributeRange(equipmentLevel)
  const available = [...ATTRIBUTES]
  const attributeBonuses: DaoEquipmentAttributeRoll[] = []
  for (let index = 0; index < count; index += 1) {
    const attr = available[Math.floor(rng.next() * available.length)]
    available.splice(available.indexOf(attr), 1)
    attributeBonuses.push({ attr, value: integer(rng, minBonus, maxBonus) })
  }

  return { rng, baseStats, attributeBonuses }
}

function essenceCount(roll: number): 0 | 1 | 2 {
  const [zero, one] = DAO_EQUIPMENT_SPECIAL_GENERATION.essenceCountProbabilities
  if (roll < zero) return 0
  if (roll < zero + one) return 1
  return 2
}

export function generateDaoEquipmentV2(
  input: GenerateDaoEquipmentV2Input,
): DaoEquipmentGenerationResult {
  const diagnostics: CombatV6ProjectionDiagnostic[] = []
  const template = daoEquipmentTemplateOf(input.templateId)
  if (!template) diagnostics.push(error("UNKNOWN_EQUIPMENT_TEMPLATE", "道装模板不存在", "templateId"))
  if (!isOpenEquipmentLevel(input.equipmentLevel)) diagnostics.push(error("INVALID_EQUIPMENT_LEVEL", "道装仅开放至化神期", "equipmentLevel"))
  if (!Number.isInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) diagnostics.push(error("INVALID_EQUIPMENT_IDENTITY", "seed 必须是0～2^32-1的整数", "seed"))
  if (!input.id?.trim() || !input.createdAt?.trim()) diagnostics.push(error("INVALID_EQUIPMENT_IDENTITY", "道装 id 与 createdAt 不能为空"))
  if (input.generatorVersion !== DAO_EQUIPMENT_GENERATOR_VERSION_V2) diagnostics.push(error("INVALID_EQUIPMENT_IDENTITY", "生成器版本不受支持", "generatorVersion"))
  if (!Number.isFinite(input.baseQuality ?? 0) || (input.baseQuality ?? 0) < 0 || (input.baseQuality ?? 0) > 1)
    diagnostics.push(error("INVALID_EQUIPMENT_IDENTITY", "材料品阶进度必须在0～1之间", "baseQuality"))
  if (!template || diagnostics.length > 0) return { ok: false, diagnostics }

  const { rng, baseStats, attributeBonuses } = generateBaseRolls(
    input.seed,
    input.equipmentLevel,
    template,
    input.baseQuality ?? 0,
  )
  const count = essenceCount(rng.next())
  const essencePool = equipmentEssencePool(template.slot)
  const essenceIds: string[] = []
  for (let index = 0; index < count; index += 1) {
    const pick = Math.floor(rng.next() * essencePool.length)
    essenceIds.push(essencePool.splice(pick, 1)[0])
  }
  const artPool = equipmentArtPool(template.slot)
  const artId = rng.next() < DAO_EQUIPMENT_SPECIAL_GENERATION.artChance
    ? artPool[Math.floor(rng.next() * artPool.length)]
    : undefined

  return {
    ok: true,
    instance: {
      schemaVersion: 1,
      numericVersion: 2,
      baseQuality: input.baseQuality ?? 0,
      id: input.id,
      templateId: template.id,
      name: template.name,
      slot: template.slot,
      equipmentLevel: input.equipmentLevel,
      requiredLevel: equipmentRealm(input.equipmentLevel).requiredLevel,
      baseStats,
      attributeBonuses,
      essenceIds,
      artId,
      formationInscription: undefined,
      appraisalState: "appraised",
      generatorVersion: DAO_EQUIPMENT_GENERATOR_VERSION_V2,
      createdAt: input.createdAt,
    },
    diagnostics,
  }
}

export const daoEquipmentGenerationRulesV1 = {
  bonusCount,
  attributeRange: daoEquipmentAttributeRange,
}

export const daoEquipmentGenerationRulesV2 = { essenceCount, artChance: DAO_EQUIPMENT_SPECIAL_GENERATION.artChance }
