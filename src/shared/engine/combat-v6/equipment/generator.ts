import { SeededRng } from "../core/index.ts"
import type { CombatV6ProjectionDiagnostic } from "../projection/types.ts"
import { daoEquipmentTemplateOf } from "./content.ts"
import {
  DAO_EQUIPMENT_ARTS_V1,
  DAO_EQUIPMENT_ESSENCES_V1,
} from "./special-content.ts"
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

function isEquipmentLevel(level: number): boolean {
  return Number.isInteger(level) && level >= 10 && level <= 180 && level % 10 === 0
}

function integer(rng: SeededRng, min: number, max: number): number {
  return min + Math.floor(rng.next() * (max - min + 1))
}

function bonusCount(roll: number): 0 | 1 | 2 {
  if (roll < 0.5) return 0
  if (roll < 0.9) return 1
  return 2
}

function takeWeightedAttribute(
  rng: SeededRng,
  available: DaoEquipmentAttribute[],
  favored: DaoEquipmentAttribute[],
): DaoEquipmentAttribute {
  const weights = available.map((attr) => (favored.includes(attr) ? 2 : 1))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let roll = rng.next() * total
  for (let index = 0; index < available.length; index += 1) {
    roll -= weights[index]
    if (roll < 0) return available[index]
  }
  return available[available.length - 1]
}

export function generateDaoEquipmentV1(
  input: GenerateDaoEquipmentV1Input,
): DaoEquipmentGenerationResult {
  const diagnostics: CombatV6ProjectionDiagnostic[] = []
  const template = daoEquipmentTemplateOf(input.templateId)
  if (!template) {
    diagnostics.push(error("UNKNOWN_EQUIPMENT_TEMPLATE", "道装模板不存在", "templateId"))
  }
  if (!isEquipmentLevel(input.equipmentLevel)) {
    diagnostics.push(error("INVALID_EQUIPMENT_LEVEL", "器阶必须是10～180之间的10倍数", "equipmentLevel"))
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
  if (!template || diagnostics.length > 0) return { ok: false, diagnostics }

  const { rng, baseStats, attributeBonuses } = generateBaseRolls(
    input.seed,
    input.equipmentLevel,
    template,
  )
  void rng
  return {
    ok: true,
    instance: {
      schemaVersion: 1,
      id: input.id,
      templateId: template.id,
      name: template.name,
      slot: template.slot,
      equipmentLevel: input.equipmentLevel,
      requiredLevel: input.equipmentLevel,
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
): {
  rng: SeededRng
  baseStats: Array<{ attr: (typeof template.baseStats)[number]["attr"]; value: number }>
  attributeBonuses: DaoEquipmentAttributeRoll[]
} {
  const rng = new SeededRng(seed)
  const baseStats = template.baseStats.map((rule) => ({
    attr: rule.attr,
    value: integer(
      rng,
      Math.floor(equipmentLevel * rule.minCoefficient),
      Math.floor(equipmentLevel * rule.maxCoefficient),
    ),
  }))
  const count = bonusCount(rng.next())
  const minBonus = Math.max(1, Math.floor(equipmentLevel * 0.08))
  const maxBonus = Math.max(1, Math.floor(equipmentLevel * 0.14))
  const available = [...ATTRIBUTES]
  const attributeBonuses: DaoEquipmentAttributeRoll[] = []
  for (let index = 0; index < count; index += 1) {
    const attr = takeWeightedAttribute(rng, available, template.favoredAttributes)
    available.splice(available.indexOf(attr), 1)
    attributeBonuses.push({ attr, value: integer(rng, minBonus, maxBonus) })
  }

  return { rng, baseStats, attributeBonuses }
}

function essenceCount(roll: number): 0 | 1 | 2 {
  if (roll < 0.82) return 0
  if (roll < 0.98) return 1
  return 2
}

export function generateDaoEquipmentV2(
  input: GenerateDaoEquipmentV2Input,
): DaoEquipmentGenerationResult {
  const diagnostics: CombatV6ProjectionDiagnostic[] = []
  const template = daoEquipmentTemplateOf(input.templateId)
  if (!template) diagnostics.push(error("UNKNOWN_EQUIPMENT_TEMPLATE", "道装模板不存在", "templateId"))
  if (!isEquipmentLevel(input.equipmentLevel)) diagnostics.push(error("INVALID_EQUIPMENT_LEVEL", "器阶必须是10～180之间的10倍数", "equipmentLevel"))
  if (!Number.isInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff) diagnostics.push(error("INVALID_EQUIPMENT_IDENTITY", "seed 必须是0～2^32-1的整数", "seed"))
  if (!input.id?.trim() || !input.createdAt?.trim()) diagnostics.push(error("INVALID_EQUIPMENT_IDENTITY", "道装 id 与 createdAt 不能为空"))
  if (input.generatorVersion !== DAO_EQUIPMENT_GENERATOR_VERSION_V2) diagnostics.push(error("INVALID_EQUIPMENT_IDENTITY", "生成器版本不受支持", "generatorVersion"))
  if (!template || diagnostics.length > 0) return { ok: false, diagnostics }

  const { rng, baseStats, attributeBonuses } = generateBaseRolls(
    input.seed,
    input.equipmentLevel,
    template,
  )
  const count = essenceCount(rng.next())
  const essencePool = DAO_EQUIPMENT_ESSENCES_V1.map((definition) => definition.id)
  const essenceIds: string[] = []
  for (let index = 0; index < count; index += 1) {
    const pick = Math.floor(rng.next() * essencePool.length)
    essenceIds.push(essencePool.splice(pick, 1)[0])
  }
  const artId = rng.next() < 0.08
    ? DAO_EQUIPMENT_ARTS_V1[Math.floor(rng.next() * DAO_EQUIPMENT_ARTS_V1.length)].id
    : undefined

  return {
    ok: true,
    instance: {
      schemaVersion: 1,
      id: input.id,
      templateId: template.id,
      name: template.name,
      slot: template.slot,
      equipmentLevel: input.equipmentLevel,
      requiredLevel: input.equipmentLevel,
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
  attributeRange(equipmentLevel: number): { min: number; max: number } {
    return {
      min: Math.max(1, Math.floor(equipmentLevel * 0.08)),
      max: Math.max(1, Math.floor(equipmentLevel * 0.14)),
    }
  },
}

export const daoEquipmentGenerationRulesV2 = { essenceCount, artChance: 0.08 }
