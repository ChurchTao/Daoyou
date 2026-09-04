import type { Attributes } from "@shared/types/cultivator"
import { compileSectCombatV6, compileSectCombatV6V2, compileSectCombatV6V3, compileSectCombatV6V4 } from "../content/index.ts"
import { ATTR_NAMES, type AttrName, type CombatV6VersionStamp, type LineupUnit } from "../core/index.ts"
import {
  DAO_EQUIPMENT_ARTS_V1,
  DAO_EQUIPMENT_ART_SKILL_ID,
  DAO_RAGE_RESOURCE_ID,
  compileDaoEquipmentSpecialLoadoutV1,
} from "../equipment/index.ts"
import { COMBAT_V6_PHASE_4B_VERSIONS } from "../version.ts"
import { compileBodyCultivationV6 } from "./body-cultivation-v6.ts"
import { compileCharacterPanelV1 } from "./character-panel-v1.ts"
import { projectCultivatorBaseToCombatV6 } from "./project-cultivator-base.ts"
import type {
  CombatV6PanelContribution,
  CombatV6ProjectionDiagnostic,
  CombatV6ProjectionResult,
  CompareDaoEquipmentSpecialLoadoutsV1Input,
  CompareDaoEquipmentSpecialLoadoutsV1Result,
  ProjectCultivatorWithEquipmentSpecialInput,
} from "./types.ts"

const ATTRIBUTE_KEYS = [
  "vitality",
  "strength",
  "spirit",
  "endurance",
  "speed",
  "willpower",
] as const satisfies readonly (keyof Attributes)[]

function hasErrors(diagnostics: CombatV6ProjectionDiagnostic[]): boolean {
  return diagnostics.some((item) => item.severity === "error")
}

function applyContribution(attrs: LineupUnit["attrs"], contribution: CombatV6PanelContribution): void {
  const values = attrs as Record<string, number | undefined>
  const current = values[contribution.attr] ?? 0
  values[contribution.attr] = contribution.mode === "add"
    ? Math.floor(current + contribution.value)
    : Math.floor(current * contribution.value)
}

function panelAttrs(attributes: Attributes): LineupUnit["attrs"] {
  const panel = compileCharacterPanelV1(attributes)
  return {
    hp: panel.maxHp,
    maxHp: panel.maxHp,
    mp: panel.maxMp,
    maxMp: panel.maxMp,
    physicalAtk: panel.physicalAtk,
    physicalDef: panel.physicalDef,
    magicAtk: panel.magicAtk,
    magicDef: panel.magicDef,
    healPower: panel.healPower,
    speed: panel.speed,
    hit: panel.hit,
    dodge: panel.dodge,
    critRate: panel.critRate,
    spellCritRate: panel.spellCritRate,
    physicalFuryRate: panel.physicalFuryRate,
    sealHit: panel.sealHit,
    sealResist: panel.sealResist,
    attackCultivate: 0,
    defenseCultivate: 0,
    spellCultivate: 0,
    resistSpellCultivate: 0,
  }
}

function applyResources(
  input: ProjectCultivatorWithEquipmentSpecialInput,
  attrs: LineupUnit["attrs"],
  diagnostics: CombatV6ProjectionDiagnostic[],
): void {
  if (input.resourcePolicy === "full") {
    attrs.hp = attrs.maxHp ?? attrs.hp
    attrs.mp = attrs.maxMp ?? 0
    return
  }
  const resources = input.cultivator.condition?.resources
  if (!resources) {
    diagnostics.push({ severity: "error", code: "MISSING_PERSISTENT_RESOURCES", message: "persistent 资源策略要求角色存在当前气血和法力", path: "cultivator.condition.resources" })
    return
  }
  const currentHp = resources.hp?.current
  const currentMp = resources.mp?.current
  if (!Number.isFinite(currentHp)) diagnostics.push({ severity: "error", code: "INVALID_PERSISTENT_RESOURCE", message: "当前气血必须是有限数", path: "cultivator.condition.resources.hp.current" })
  if (!Number.isFinite(currentMp)) diagnostics.push({ severity: "error", code: "INVALID_PERSISTENT_RESOURCE", message: "当前法力必须是有限数", path: "cultivator.condition.resources.mp.current" })
  if (!Number.isFinite(currentHp) || !Number.isFinite(currentMp)) return
  const maxHp = attrs.maxHp ?? attrs.hp
  const maxMp = attrs.maxMp ?? 0
  attrs.hp = Math.min(maxHp, Math.max(0, currentHp!))
  attrs.mp = Math.min(maxMp, Math.max(0, currentMp!))
  if (attrs.hp !== currentHp) diagnostics.push({ severity: "warning", code: "RESOURCE_CLAMPED", message: `当前气血已夹取到 0～${maxHp}`, path: "cultivator.condition.resources.hp.current" })
  if (attrs.mp !== currentMp) diagnostics.push({ severity: "warning", code: "RESOURCE_CLAMPED", message: `当前法力已夹取到 0～${maxMp}`, path: "cultivator.condition.resources.mp.current" })
  if (attrs.hp <= 0) diagnostics.push({ severity: "error", code: "PERSISTENT_HP_DEPLETED", message: "当前气血为 0 的角色不能进入战斗", path: "cultivator.condition.resources.hp.current" })
}

function contentConflicts(
  sect: Extract<ReturnType<typeof compileSectCombatV6>, { ok: true }>["projection"],
  equipment: Extract<ReturnType<typeof compileDaoEquipmentSpecialLoadoutV1>, { ok: true }>["projection"],
): CombatV6ProjectionDiagnostic[] {
  const diagnostics: CombatV6ProjectionDiagnostic[] = []
  const duplicate = (left: string[], right: string[], kind: string) => {
    for (const id of new Set(left.filter((candidate) => right.includes(candidate)))) {
      diagnostics.push({ severity: "error", code: "CONTENT_ID_CONFLICT", message: `${kind} ID 冲突：${id}` })
    }
  }
  duplicate(sect.skills.map((item) => item.id), equipment.skills.map((item) => item.id), "技能")
  duplicate(sect.statusDefs.map((item) => item.id), equipment.statusDefs.map((item) => item.id), "状态")
  duplicate(sect.resources.map((item) => item.id), [DAO_RAGE_RESOURCE_ID], "资源")
  const sectIds = [
    ...sect.skills.map((item) => item.id),
    ...sect.statusDefs.map((item) => item.id),
    ...sect.resources.map((item) => item.id),
  ]
  duplicate(sectIds, equipment.effectiveEssenceIds, "器蕴")
  duplicate(sectIds, equipment.grantedArtIds, "器诀")
  return diagnostics
}

export function projectCultivatorWithEquipmentSpecialInternal(
  input: ProjectCultivatorWithEquipmentSpecialInput,
  versions: CombatV6VersionStamp,
  allowMultiSect: boolean,
  allowWuxiang = false,
  allowTianyan = false,
  allowJiujie = false,
): CombatV6ProjectionResult {
  if (input.sect.sectId === "jiujie" && !allowJiujie) return { ok: false, diagnostics: [{ severity: "error", code: "INVALID_SECT_ID", message: `${versions.projectionVersion} 不接受九劫天宫`, path: "sect.sectId" }], versions }
  if (input.sect.sectId === "tianyan" && !allowTianyan) return { ok: false, diagnostics: [{ severity: "error", code: "INVALID_SECT_ID", message: `${versions.projectionVersion} 不接受天衍圣地`, path: "sect.sectId" }], versions }
  if (input.sect.sectId === "wuxiang" && !allowWuxiang) return { ok: false, diagnostics: [{ severity: "error", code: "INVALID_SECT_ID", message: `${versions.projectionVersion} 不接受无相禅宗`, path: "sect.sectId" }], versions }
  if (!allowMultiSect && input.sect.sectId !== "lingxiao") return { ok: false, diagnostics: [{ severity: "error", code: "INVALID_SECT_ID", message: "character_equipment_special_v1 只接受红尘剑宗", path: "sect.sectId" }], versions }
  const base = projectCultivatorBaseToCombatV6({ ...input, resourcePolicy: "full" })
  if (!base.ok) return { ok: false, diagnostics: base.diagnostics, versions }
  const equipment = compileDaoEquipmentSpecialLoadoutV1(input.equipment, base.unit.level ?? 0)
  if (!equipment.ok) return { ok: false, diagnostics: [...base.diagnostics, ...equipment.diagnostics], versions }

  const effectiveAttributes = { ...input.cultivator.attributes }
  for (const key of ATTRIBUTE_KEYS) effectiveAttributes[key] += equipment.projection.attributeBonuses[key]
  const characterPanel = compileCharacterPanelV1(effectiveAttributes)
  const training = compileBodyCultivationV6(input.cultivator.condition?.tracks.bodyCultivation, characterPanel)
  const sect = allowJiujie
    ? compileSectCombatV6V4({ progress: input.sect, characterLevel: base.unit.level ?? 0 })
    : allowTianyan
    ? compileSectCombatV6V3({ progress: input.sect, characterLevel: base.unit.level ?? 0 })
    : allowWuxiang
      ? compileSectCombatV6V2({ progress: input.sect, characterLevel: base.unit.level ?? 0 })
    : compileSectCombatV6({ progress: input.sect, characterLevel: base.unit.level ?? 0 })
  const diagnostics = [
    ...base.diagnostics,
    ...equipment.projection.diagnostics,
    ...training.diagnostics,
    ...(sect.ok ? sect.projection.diagnostics : sect.diagnostics),
  ]
  if (!sect.ok) return { ok: false, diagnostics, versions }
  diagnostics.push(...contentConflicts(sect.projection, equipment.projection))
  if (hasErrors(diagnostics)) return { ok: false, diagnostics, versions }

  const attrs = panelAttrs(effectiveAttributes)
  attrs.maxHp = (attrs.maxHp ?? 0) + training.maxHpBonus
  attrs.healPower = (attrs.healPower ?? 0) + training.healPowerBonus
  attrs.attackCultivate = training.attackCultivate
  attrs.defenseCultivate = training.defenseCultivate
  attrs.spellCultivate = training.spellCultivate
  attrs.resistSpellCultivate = training.resistSpellCultivate
  for (const roll of equipment.projection.panel) applyContribution(attrs, { attr: roll.attr, mode: "add", value: roll.value })
  for (const contribution of sect.projection.panel) applyContribution(attrs, contribution)
  applyResources(input, attrs, diagnostics)
  if (hasErrors(diagnostics)) return { ok: false, diagnostics, versions }

  const artSkillIds = DAO_EQUIPMENT_ARTS_V1
    .filter((art) => equipment.projection.grantedArtIds.includes(art.id))
    .map((art) => art.skill.id)
  const artSkillLevels = Object.fromEntries(artSkillIds.map((id) => [id, 0]))
  const phase6Overrides = allowMultiSect && artSkillIds.includes(DAO_EQUIPMENT_ART_SKILL_ID.Qingxin)
    ? DAO_EQUIPMENT_ARTS_V1
        .filter((art) => art.skill.id === DAO_EQUIPMENT_ART_SKILL_ID.Qingxin)
        .map((art) => ({ ...structuredClone(art.skill), targeting: { ...art.skill.targeting, includeDowned: true } }))
    : []
  return {
    ok: true,
    unit: {
      ...base.unit,
      attrs,
      skills: [...sect.projection.activeSkillIds, ...artSkillIds],
      passives: [...sect.projection.passiveSkillIds, ...equipment.projection.passiveSkillIds],
      skillLevels: { ...sect.projection.skillLevels, ...artSkillLevels },
      skillOverrides: [...sect.projection.skillOverrides, ...equipment.projection.skillOverrides, ...phase6Overrides],
      resources: [
        ...sect.projection.resources,
        { id: DAO_RAGE_RESOURCE_ID, name: "战意", current: 0, max: 150 },
      ],
      tags: [...(base.unit.tags ?? []), ...sect.projection.unitTags],
    },
    skills: [...sect.projection.skills, ...equipment.projection.skills],
    statusDefs: [...sect.projection.statusDefs, ...equipment.projection.statusDefs],
    diagnostics,
    versions,
  }
}

export function projectCultivatorWithEquipmentSpecialToCombatV6(
  input: ProjectCultivatorWithEquipmentSpecialInput,
): CombatV6ProjectionResult {
  return projectCultivatorWithEquipmentSpecialInternal(input, { ...COMBAT_V6_PHASE_4B_VERSIONS }, false)
}

function setChanges(before: string[], after: string[]): { added: string[]; removed: string[] } {
  return {
    added: after.filter((id) => !before.includes(id)),
    removed: before.filter((id) => !after.includes(id)),
  }
}

export function compareDaoEquipmentSpecialLoadoutsV1(
  input: CompareDaoEquipmentSpecialLoadoutsV1Input,
): CompareDaoEquipmentSpecialLoadoutsV1Result {
  const { before, after, ...common } = input
  const beforeResult = projectCultivatorWithEquipmentSpecialToCombatV6({ ...common, equipment: before })
  const afterResult = projectCultivatorWithEquipmentSpecialToCombatV6({ ...common, equipment: after })
  if (!beforeResult.ok || !afterResult.ok) return { ok: false, beforeDiagnostics: beforeResult.diagnostics, afterDiagnostics: afterResult.diagnostics }

  const level = beforeResult.unit.level ?? 0
  const beforeEquipment = compileDaoEquipmentSpecialLoadoutV1(before, level)
  const afterEquipment = compileDaoEquipmentSpecialLoadoutV1(after, level)
  if (!beforeEquipment.ok || !afterEquipment.ok) return {
    ok: false,
    beforeDiagnostics: beforeEquipment.ok ? beforeEquipment.projection.diagnostics : beforeEquipment.diagnostics,
    afterDiagnostics: afterEquipment.ok ? afterEquipment.projection.diagnostics : afterEquipment.diagnostics,
  }
  const effectiveAttributeDiffs = Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, afterEquipment.projection.attributeBonuses[key] - beforeEquipment.projection.attributeBonuses[key]])) as unknown as Attributes
  const panelDiffs: Partial<Record<AttrName, number>> = {}
  for (const attr of ATTR_NAMES) {
    const difference = (afterResult.unit.attrs[attr] ?? 0) - (beforeResult.unit.attrs[attr] ?? 0)
    if (difference !== 0) panelDiffs[attr] = difference
  }
  return {
    ok: true,
    effectiveAttributeDiffs,
    panelDiffs,
    effectiveEssenceChanges: setChanges(beforeEquipment.projection.effectiveEssenceIds, afterEquipment.projection.effectiveEssenceIds),
    grantedArtChanges: setChanges(beforeEquipment.projection.grantedArtIds, afterEquipment.projection.grantedArtIds),
    beforeDiagnostics: beforeResult.diagnostics,
    afterDiagnostics: afterResult.diagnostics,
  }
}
