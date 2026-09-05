import type { Attributes } from "@shared/types/cultivator"
import type { CombatV6ProjectionDiagnostic } from "../projection/types.ts"
import {
  daoEquipmentTemplateOf,
  daoFormationInscriptionOf,
} from "./content.ts"
import {
  DAO_EQUIPMENT_ARTS_V1,
  DAO_EQUIPMENT_ESSENCES_V1,
  DAO_RAGE_RESOURCE_ID,
  createDaoRageGainPassive,
} from "./special-content.ts"
import {
  DAO_EQUIPMENT_GENERATOR_VERSION,
  DAO_EQUIPMENT_GENERATOR_VERSION_V2,
  DAO_EQUIPMENT_SLOTS,
  type CompileDaoEquipmentLoadoutV1Result,
  type CompileDaoEquipmentSpecialLoadoutV1Result,
  type DaoEquipmentArtDefV1,
  type DaoEquipmentAttribute,
  type DaoEquipmentInstanceV1,
  type DaoEquipmentLoadoutV1,
  type DaoEquipmentEssenceDefV1,
  type DaoEquipmentPanelRoll,
} from "./types.ts"

const ATTRIBUTE_KEYS: DaoEquipmentAttribute[] = [
  "vitality",
  "strength",
  "spirit",
  "endurance",
  "speed",
  "willpower",
]

const EQUIPMENT_PANEL_ATTRS = new Set<DaoEquipmentPanelRoll["attr"]>([
  "physicalAtk", "physicalDef", "magicAtk", "magicDef", "maxHp", "maxMp",
  "healPower", "speed", "hit", "dodge", "critRate", "spellCritRate",
  "physicalFuryRate", "sealHit", "sealResist",
])

const FORBIDDEN_FIELDS = new Set([
  "quality",
  "rarity",
  "tierColor",
  "itemGrade",
  "powerScore",
  "equipmentRating",
  "battleProjection",
  "SkillDef",
  "tempering",
])

function diagnostic(
  code: CombatV6ProjectionDiagnostic["code"],
  message: string,
  path?: string,
): CombatV6ProjectionDiagnostic {
  return { severity: "error", code, message, ...(path ? { path } : {}) }
}

function equipmentLevelIsValid(level: number): boolean {
  return Number.isInteger(level) && level >= 10 && level <= 180 && level % 10 === 0
}

function rollIsIntegerInRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value >= min && value <= max
}

export function validateDaoEquipmentInstanceV1(
  instance: DaoEquipmentInstanceV1,
): CombatV6ProjectionDiagnostic[] {
  return validateInstance(instance, false)
}

function validateInstance(
  instance: DaoEquipmentInstanceV1,
  special: boolean,
): CombatV6ProjectionDiagnostic[] {
  const diagnostics: CombatV6ProjectionDiagnostic[] = []
  const raw = instance as unknown as Record<string, unknown>
  for (const key of Object.keys(raw)) {
    if (FORBIDDEN_FIELDS.has(key)) {
      diagnostics.push(diagnostic("FORBIDDEN_EQUIPMENT_FIELD", `道装禁止字段 ${key}`, key))
    }
  }

  if (
    raw.schemaVersion !== 1 ||
    typeof instance.id !== "string" ||
    instance.id.trim().length === 0 ||
    typeof instance.name !== "string" ||
    instance.name.trim().length === 0 ||
    typeof instance.createdAt !== "string" ||
    instance.createdAt.trim().length === 0 ||
    (!special
      ? instance.generatorVersion !== DAO_EQUIPMENT_GENERATOR_VERSION
      : instance.generatorVersion !== DAO_EQUIPMENT_GENERATOR_VERSION &&
        instance.generatorVersion !== DAO_EQUIPMENT_GENERATOR_VERSION_V2) ||
    instance.appraisalState !== "appraised"
  ) {
    diagnostics.push(diagnostic("INVALID_EQUIPMENT_IDENTITY", "道装身份、版本或鉴定状态无效"))
  }

  const template = daoEquipmentTemplateOf(instance.templateId)
  if (!template) {
    diagnostics.push(diagnostic("UNKNOWN_EQUIPMENT_TEMPLATE", "道装模板不存在", "templateId"))
  }
  if (
    !equipmentLevelIsValid(instance.equipmentLevel) ||
    instance.requiredLevel !== instance.equipmentLevel
  ) {
    diagnostics.push(diagnostic("INVALID_EQUIPMENT_LEVEL", "器阶必须为10～180的10倍数且御使等级必须相等"))
  }
  if (template && (instance.slot !== template.slot || instance.name !== template.name)) {
    diagnostics.push(diagnostic("EQUIPMENT_SLOT_MISMATCH", "道装部位或标准名称与模板不一致", "slot"))
  }

  if (!Array.isArray(instance.baseStats)) {
    diagnostics.push(diagnostic("INVALID_EQUIPMENT_BASE_STAT", "器胚属性必须是数组", "baseStats"))
  } else if (template) {
    const expectedAttrs = template.baseStats.map((rule) => rule.attr)
    const actualAttrs = instance.baseStats.map((roll) => roll?.attr)
    if (
      actualAttrs.length !== expectedAttrs.length ||
      new Set(actualAttrs).size !== actualAttrs.length ||
      actualAttrs.some((attr) => !expectedAttrs.includes(attr!))
    ) {
      diagnostics.push(diagnostic("INVALID_EQUIPMENT_BASE_STAT", "器胚字段必须与模板集合完全一致且不得重复", "baseStats"))
    }
    for (let index = 0; index < template.baseStats.length; index += 1) {
      const rule = template.baseStats[index]
      const roll = instance.baseStats.find((candidate) => candidate?.attr === rule.attr)
      const min = Math.floor(instance.equipmentLevel * rule.minCoefficient)
      const max = Math.floor(instance.equipmentLevel * rule.maxCoefficient)
      if (!roll || roll.attr !== rule.attr || !rollIsIntegerInRange(roll.value, min, max)) {
        diagnostics.push(diagnostic("INVALID_EQUIPMENT_BASE_STAT", `${rule.attr} 必须位于 ${min}～${max}`, `baseStats.${index}`))
      }
    }
  }

  if (!Array.isArray(instance.attributeBonuses) || instance.attributeBonuses.length > 2) {
    diagnostics.push(diagnostic("INVALID_EQUIPMENT_ATTRIBUTE_BONUS", "附灵必须为不超过2条的数组", "attributeBonuses"))
  } else {
    const min = Math.max(1, Math.floor(instance.equipmentLevel * 0.08))
    const max = Math.max(1, Math.floor(instance.equipmentLevel * 0.14))
    const seen = new Set<string>()
    for (let index = 0; index < instance.attributeBonuses.length; index += 1) {
      const roll = instance.attributeBonuses[index]
      if (
        !roll ||
        !ATTRIBUTE_KEYS.includes(roll.attr) ||
        seen.has(roll.attr) ||
        !rollIsIntegerInRange(roll.value, min, max)
      ) {
        diagnostics.push(diagnostic("INVALID_EQUIPMENT_ATTRIBUTE_BONUS", `附灵必须使用不重复六维且数值位于 ${min}～${max}`, `attributeBonuses.${index}`))
      }
      if (roll) seen.add(roll.attr)
    }
  }

  if (!Array.isArray(instance.essenceIds) || instance.essenceIds.length > 2 || new Set(instance.essenceIds).size !== instance.essenceIds.length) {
    diagnostics.push(diagnostic("UNSUPPORTED_EQUIPMENT_CONTENT", "器蕴最多2个且不得重复", "essenceIds"))
  } else if (!special && instance.essenceIds.length > 0) {
    diagnostics.push(diagnostic("UNSUPPORTED_EQUIPMENT_CONTENT", "Phase 4A 不投影器蕴", "essenceIds"))
  }
  if (instance.artId !== undefined) {
    if (typeof instance.artId !== "string" || instance.artId.trim().length === 0) {
      diagnostics.push(diagnostic("UNSUPPORTED_EQUIPMENT_CONTENT", "器诀 ID 无效", "artId"))
    } else if (!special) {
      diagnostics.push(diagnostic("UNSUPPORTED_EQUIPMENT_CONTENT", "Phase 4A 不投影器诀", "artId"))
    }
  }

  if (
    special &&
    instance.generatorVersion === DAO_EQUIPMENT_GENERATOR_VERSION &&
    (instance.essenceIds.length > 0 || instance.artId !== undefined)
  ) {
    diagnostics.push(diagnostic("EQUIPMENT_SPECIAL_GENERATOR_MISMATCH", "v1 生成实例不得携带器蕴或器诀"))
  }

  if (instance.formationInscription) {
    const formation = instance.formationInscription
    const definition = daoFormationInscriptionOf(formation.patternId)
    if (!definition) {
      diagnostics.push(diagnostic("UNKNOWN_FORMATION_INSCRIPTION", "阵法灵纹不存在", "formationInscription.patternId"))
    } else if (!definition.allowedSlots.includes(instance.slot)) {
      diagnostics.push(diagnostic("FORMATION_INSCRIPTION_SLOT_MISMATCH", "阵法灵纹不能刻于该部位", "formationInscription.patternId"))
    }
    const maxLevel = Math.min(18, instance.equipmentLevel / 10)
    if (!Number.isInteger(formation.level) || formation.level < 1 || formation.level > maxLevel) {
      diagnostics.push(diagnostic("FORMATION_INSCRIPTION_LEVEL_INVALID", `阵法灵纹等级必须为1～${maxLevel}的整数`, "formationInscription.level"))
    }
  }

  return diagnostics
}

function emptyAttributes(): Attributes {
  return {
    vitality: 0,
    strength: 0,
    spirit: 0,
    endurance: 0,
    speed: 0,
    willpower: 0,
  }
}

function addPanelRoll(
  panel: Map<DaoEquipmentPanelRoll["attr"], number>,
  roll: DaoEquipmentPanelRoll,
): void {
  panel.set(roll.attr, (panel.get(roll.attr) ?? 0) + roll.value)
}

export function compileDaoEquipmentLoadoutV1(
  loadout: DaoEquipmentLoadoutV1,
  characterLevel: number,
): CompileDaoEquipmentLoadoutV1Result {
  const diagnostics: CombatV6ProjectionDiagnostic[] = []
  const attributes = emptyAttributes()
  const panel = new Map<DaoEquipmentPanelRoll["attr"], number>()
  const instanceIds = new Set<string>()

  for (const key of Object.keys(loadout)) {
    if (!DAO_EQUIPMENT_SLOTS.includes(key as (typeof DAO_EQUIPMENT_SLOTS)[number])) {
      diagnostics.push(diagnostic("EQUIPMENT_SLOT_MISMATCH", `未知装配槽 ${key}`, key))
    }
  }

  for (const slot of DAO_EQUIPMENT_SLOTS) {
    const instance = loadout[slot]
    if (!instance) continue
    diagnostics.push(...validateDaoEquipmentInstanceV1(instance).map((item) => ({ ...item, path: item.path ? `${slot}.${item.path}` : slot })))
    if (instance.slot !== slot) {
      diagnostics.push(diagnostic("EQUIPMENT_SLOT_MISMATCH", "实例自身部位与装配槽不一致", slot))
    }
    if (instanceIds.has(instance.id)) {
      diagnostics.push(diagnostic("DUPLICATE_EQUIPMENT_INSTANCE", "同一道装实例不能占据多个槽位", slot))
    }
    instanceIds.add(instance.id)
    if (!Number.isFinite(characterLevel) || characterLevel < instance.requiredLevel) {
      diagnostics.push(diagnostic("EQUIPMENT_LEVEL_REQUIREMENT", `人物等级不足以御使 ${instance.name}`, slot))
    }
  }

  if (diagnostics.some((item) => item.severity === "error")) {
    return { ok: false, diagnostics }
  }

  for (const slot of DAO_EQUIPMENT_SLOTS) {
    const instance = loadout[slot]
    if (!instance) continue
    for (const roll of instance.attributeBonuses) attributes[roll.attr] += roll.value
    for (const roll of instance.baseStats) addPanelRoll(panel, roll)
    if (instance.formationInscription) {
      const definition = daoFormationInscriptionOf(instance.formationInscription.patternId)!
      addPanelRoll(panel, {
        attr: definition.attr,
        value: definition.valuePerLevel * instance.formationInscription.level,
      })
    }
  }

  return {
    ok: true,
    projection: {
      attributeBonuses: attributes,
      panel: [...panel].map(([attr, value]) => ({ attr, value })),
      diagnostics,
    },
  }
}

export type CompileDaoEquipmentSpecialOptions = {
  essenceDefs?: readonly DaoEquipmentEssenceDefV1[]
  artDefs?: readonly DaoEquipmentArtDefV1[]
}

function warning(
  code: CombatV6ProjectionDiagnostic["code"],
  message: string,
  path?: string,
): CombatV6ProjectionDiagnostic {
  return { severity: "warning", code, message, ...(path ? { path } : {}) }
}

export function compileDaoEquipmentSpecialLoadoutV1(
  loadout: DaoEquipmentLoadoutV1,
  characterLevel: number,
  options: CompileDaoEquipmentSpecialOptions = {},
): CompileDaoEquipmentSpecialLoadoutV1Result {
  const essenceDefs = options.essenceDefs ?? DAO_EQUIPMENT_ESSENCES_V1
  const artDefs = options.artDefs ?? DAO_EQUIPMENT_ARTS_V1
  const essenceMap = new Map(essenceDefs.map((definition) => [definition.id, definition]))
  const artMap = new Map(artDefs.map((definition) => [definition.id, definition]))
  const diagnostics: CombatV6ProjectionDiagnostic[] = []
  const attributes = emptyAttributes()
  const panel = new Map<DaoEquipmentPanelRoll["attr"], number>()
  const instanceIds = new Set<string>()

  for (const key of Object.keys(loadout)) {
    if (!DAO_EQUIPMENT_SLOTS.includes(key as (typeof DAO_EQUIPMENT_SLOTS)[number])) {
      diagnostics.push(diagnostic("EQUIPMENT_SLOT_MISMATCH", `未知装配槽 ${key}`, key))
    }
  }

  const requiredLevelOffset = Math.min(
    0,
    ...DAO_EQUIPMENT_SLOTS.flatMap((slot) =>
      (loadout[slot]?.essenceIds ?? []).map((id) => essenceMap.get(id)?.requiredLevelOffset ?? 0),
    ),
  )
  const effectiveRequiredLevels: Partial<Record<(typeof DAO_EQUIPMENT_SLOTS)[number], number>> = {}
  const occurrences: Array<{ id: string; slot: (typeof DAO_EQUIPMENT_SLOTS)[number] }> = []
  const artOccurrences: Array<{ id: string; slot: (typeof DAO_EQUIPMENT_SLOTS)[number] }> = []

  for (const slot of DAO_EQUIPMENT_SLOTS) {
    const instance = loadout[slot]
    if (!instance) continue
    diagnostics.push(...validateInstance(instance, true).map((item) => ({
      ...item,
      path: item.path ? `${slot}.${item.path}` : slot,
    })))
    if (instance.slot !== slot) diagnostics.push(diagnostic("EQUIPMENT_SLOT_MISMATCH", "实例自身部位与装配槽不一致", slot))
    if (instanceIds.has(instance.id)) diagnostics.push(diagnostic("DUPLICATE_EQUIPMENT_INSTANCE", "同一道装实例不能占据多个槽位", slot))
    instanceIds.add(instance.id)
    const required = Math.max(0, instance.requiredLevel + requiredLevelOffset)
    effectiveRequiredLevels[slot] = required
    if (!Number.isFinite(characterLevel) || characterLevel < required) {
      diagnostics.push(diagnostic("EQUIPMENT_LEVEL_REQUIREMENT", `人物等级不足以御使 ${instance.name}`, slot))
    }
    for (const id of instance.essenceIds) {
      const definition = essenceMap.get(id)
      if (!definition) diagnostics.push(diagnostic("UNKNOWN_EQUIPMENT_ESSENCE", `未知器蕴 ${id}`, `${slot}.essenceIds`))
      else if (definition.allowedSlots && !definition.allowedSlots.includes(slot)) diagnostics.push(diagnostic("EQUIPMENT_SPECIAL_SLOT_MISMATCH", `${definition.name} 不能出现在该部位`, `${slot}.essenceIds`))
      occurrences.push({ id, slot })
    }
    if (instance.artId) {
      const definition = artMap.get(instance.artId)
      if (!definition) diagnostics.push(diagnostic("UNKNOWN_EQUIPMENT_ART", `未知器诀 ${instance.artId}`, `${slot}.artId`))
      else if (definition.allowedSlots && !definition.allowedSlots.includes(slot)) diagnostics.push(diagnostic("EQUIPMENT_SPECIAL_SLOT_MISMATCH", `${definition.name} 不能出现在该部位`, `${slot}.artId`))
      artOccurrences.push({ id: instance.artId, slot })
    }
  }

  const invalidEssenceDefs = essenceDefs.some((definition) =>
    !definition.id?.trim() ||
    !definition.name?.trim() ||
    !["stack", "unique", "highest"].includes(definition.stackPolicy) ||
    (definition.panel ?? []).some((contribution) =>
      contribution.mode !== "add" ||
      !EQUIPMENT_PANEL_ATTRS.has(contribution.attr as DaoEquipmentPanelRoll["attr"]) ||
      !Number.isFinite(contribution.value),
    ) ||
    Object.values(definition.resourceGainFactors ?? {}).some((factor) => !Number.isFinite(factor) || factor <= 0) ||
    Object.values(definition.resourceCostFactors ?? {}).some((factor) => !Number.isFinite(factor) || factor <= 0),
  )
  const invalidArtDefs = artDefs.some((definition) =>
    !definition.id?.trim() ||
    !definition.name?.trim() ||
    !Number.isFinite(definition.rageCost) ||
    definition.rageCost < 0 ||
    !definition.skill?.id ||
    definition.skill.resourceCosts?.length !== 1 ||
    definition.skill.resourceCosts[0]?.resourceId !== DAO_RAGE_RESOURCE_ID ||
    definition.skill.resourceCosts[0]?.amount !== definition.rageCost,
  )
  if (invalidEssenceDefs || invalidArtDefs) diagnostics.push(diagnostic("EQUIPMENT_SPECIAL_CONTENT_INVALID", "器蕴或器诀定义无效"))
  const contentIds = [
    ...essenceDefs.map((item) => item.id),
    ...artDefs.map((item) => item.id),
    ...artDefs.map((item) => item.skill.id),
    ...artDefs.flatMap((item) => (item.statusDefs ?? []).map((status) => status.id)),
    DAO_RAGE_RESOURCE_ID,
  ]
  if (new Set(contentIds).size !== contentIds.length) {
    diagnostics.push(diagnostic("CONTENT_ID_CONFLICT", "道装特殊内容存在重复 ID"))
  }

  const conflictGroups = new Map<string, Set<string>>()
  for (const occurrence of occurrences) {
    const definition = essenceMap.get(occurrence.id)
    if (!definition?.conflictGroup) continue
    const ids = conflictGroups.get(definition.conflictGroup) ?? new Set<string>()
    ids.add(definition.id)
    conflictGroups.set(definition.conflictGroup, ids)
  }
  for (const [group, ids] of conflictGroups) {
    if (ids.size > 1) diagnostics.push(diagnostic("EQUIPMENT_ESSENCE_CONFLICT", `器蕴冲突组 ${group} 同时生效`))
  }
  if (diagnostics.some((item) => item.severity === "error")) return { ok: false, diagnostics }

  for (const slot of DAO_EQUIPMENT_SLOTS) {
    const instance = loadout[slot]
    if (!instance) continue
    for (const roll of instance.attributeBonuses) attributes[roll.attr] += roll.value
    for (const roll of instance.baseStats) addPanelRoll(panel, roll)
    if (instance.formationInscription) {
      const definition = daoFormationInscriptionOf(instance.formationInscription.patternId)!
      addPanelRoll(panel, { attr: definition.attr, value: definition.valuePerLevel * instance.formationInscription.level })
    }
  }

  const effectiveEssenceIds: string[] = []
  const seenNonStack = new Set<string>()
  let rageGainFactor = 1
  let rageCostFactor = 1
  for (const occurrence of occurrences) {
    const definition = essenceMap.get(occurrence.id)!
    if (definition.stackPolicy !== "stack" && seenNonStack.has(definition.id)) {
      diagnostics.push(warning("EQUIPMENT_ESSENCE_DUPLICATE_IGNORED", `${definition.name} 重复，仅生效一次`, occurrence.slot))
      continue
    }
    if (definition.stackPolicy !== "stack") seenNonStack.add(definition.id)
    if (!effectiveEssenceIds.includes(definition.id)) effectiveEssenceIds.push(definition.id)
    for (const contribution of definition.panel ?? []) {
      if (contribution.mode === "add") addPanelRoll(panel, { attr: contribution.attr as DaoEquipmentPanelRoll["attr"], value: contribution.value })
      else diagnostics.push(diagnostic("EQUIPMENT_SPECIAL_CONTENT_INVALID", "器蕴首版只允许固定面板加值"))
    }
    rageGainFactor = Math.max(rageGainFactor, definition.resourceGainFactors?.[DAO_RAGE_RESOURCE_ID] ?? 1)
    rageCostFactor = Math.min(rageCostFactor, definition.resourceCostFactors?.[DAO_RAGE_RESOURCE_ID] ?? 1)
  }
  if (diagnostics.some((item) => item.severity === "error")) return { ok: false, diagnostics }

  const grantedArtIds: string[] = []
  const skills = [] as DaoEquipmentArtDefV1["skill"][]
  const statusDefs = [] as NonNullable<DaoEquipmentArtDefV1["statusDefs"]>
  for (const occurrence of artOccurrences) {
    const definition = artMap.get(occurrence.id)!
    if (grantedArtIds.includes(definition.id)) {
      diagnostics.push(warning("EQUIPMENT_ART_DUPLICATE_IGNORED", `${definition.name} 重复，仅授予一次`, occurrence.slot))
      continue
    }
    grantedArtIds.push(definition.id)
    skills.push(definition.skill)
    for (const status of definition.statusDefs ?? []) {
      if (!statusDefs.some((candidate) => candidate.id === status.id)) statusDefs.push(status)
    }
  }
  const skillOverrides = rageCostFactor === 1
    ? []
    : skills.map((skill) => ({
        ...skill,
        resourceCosts: skill.resourceCosts?.map((cost) =>
          cost.resourceId === DAO_RAGE_RESOURCE_ID
            ? { ...cost, amount: Math.floor(Number(cost.amount) * rageCostFactor) }
            : cost,
        ),
      }))
  const ragePassive = createDaoRageGainPassive(rageGainFactor)

  return {
    ok: true,
    projection: {
      attributeBonuses: attributes,
      panel: [...panel].map(([attr, value]) => ({ attr, value })),
      diagnostics,
      effectiveEssenceIds,
      grantedArtIds,
      skills: [...skills, ragePassive],
      statusDefs,
      passiveSkillIds: [ragePassive.id],
      skillOverrides,
      effectiveRequiredLevels,
      rageGainFactor,
      rageCostFactor,
    },
  }
}
